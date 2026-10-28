/* เลือกโซนสีจากแผนที่ shapefile (Leaflet + shpjs)
   ต้องใช้คู่กับ html: ปุ่ม #mapBtn และกลุ่มปุ่มโซน #zones */
(function(){
  var ZIP_URL = "shapefile.zip";   // ชื่อไฟล์ .zip (วางโฟลเดอร์เดียวกับ .html)
  var FIELD   = "PL_GROUP";        // คอลัมน์สีผังเมือง
  var LABEL   = "PL_BLOCK";        // คอลัมน์ที่ใช้เป็น label บนแผนที่
  var LABEL_MIN_ZOOM = 14;         // แสดง label เมื่อซูมตั้งแต่ระดับนี้ขึ้นไป (กันตัวหนังสือทับกัน)
  var LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/";
  var SHPJS   = "https://unpkg.com/shpjs@3.6.3/dist/shp.min.js";
  var COLORS  = {
    "ก.1":"#1fa939","ก.2":"#70e268","ก.3":"#b2df8a",
    "ย.1":"#fff128","ย.2":"#ff7f00",
    "พ.1":"#ff2323","พ.2":"#e31a1c",
    "อ.1":"#67088d","อ.2":"#c38dd6",
    "ล.":"#a6fa91","ศน.":"#b6b6b6","ศษ.":"#84a553",
    "ส.":"#0007ff","อศ.":"#8c5a38","อป.":"#f1f1f1"
  };
  var OTHER = "#000000";

  var $ = function(i){return document.getElementById(i)};
  var map, layer, built = false, loaded = false, loading = false, back, box;

  function loadCss(href){var l=document.createElement("link");l.rel="stylesheet";l.href=href;document.head.appendChild(l);}
  function loadJs(src){return new Promise(function(ok,ng){
    var s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=function(){ng(new Error("โหลดไม่ได้: "+src))};document.head.appendChild(s);
  });}
  function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function norm(s){return String(s==null?"":s).replace(/\s+/g,"")}

  /* สีพื้น + สีตัวอักษรที่อ่านออก */
  function fillOf(val){return COLORS[norm(val)]||OTHER}
  function textOn(hex){
    var n=parseInt(hex.slice(1),16),r=n>>16,g=(n>>8)&255,b=n&255;
    return(0.299*r+0.587*g+0.114*b)>150?"#1b2333":"#fff";
  }

  /* ---------- โซนจาก #zones ---------- */
  function findZoneBtn(val){
    var bs=$("zones").querySelectorAll("button"),k=norm(val);
    for(var i=0;i<bs.length;i++)if(norm(bs[i].textContent)===k)return bs[i];
    return null;
  }

  /* ---------- popup ของ feature (ปุ่มเลือก/ข้อความ อยู่ด้านบน แล้วตามด้วยตาราง) ---------- */
  function buildPopup(props){
    var el=document.createElement("div");
    var val=props?props[FIELD]:null;
    if(val!=null&&val!==""){
      var zb=findZoneBtn(val);
      if(zb){
        var bg=fillOf(val),d=document.createElement("div");d.className="mm-pick";
        d.innerHTML="<small>เลือกโซนสีนี้</small>";
        var b=document.createElement("button");b.type="button";
        b.style.cssText="--zc:"+bg+";--zt:"+textOn(bg);
        b.innerHTML="<i></i>"+esc(zb.textContent);
        b.onclick=function(){close();zb.click();};   // zb.click() -> ตั้ง zi และ class="on" ผ่าน calc()
        d.appendChild(b);el.appendChild(d);
      }else{
        var n=document.createElement("div");n.className="mm-none";
        n.textContent="โซน \""+val+"\" ไม่มีในรายการสีผังเมืองของเครื่องคำนวณ";
        el.appendChild(n);
      }
    }
    var h="<table>";
    Object.keys(props||{}).forEach(function(k){h+="<tr><td>"+esc(k)+"</td><td>"+esc(props[k])+"</td></tr>"});
    var t=document.createElement("div");t.innerHTML=h+"</table>";
    el.appendChild(t);
    return el;
  }

  /* ---------- โหลด shapefile ---------- */
  function fit(){
    if(!layer)return;
    map.invalidateSize();
    var b=layer.getBounds();
    if(b.isValid())map.fitBounds(b,{padding:[10,10]});
  }
  function showData(gj){
    if(Array.isArray(gj))gj={type:"FeatureCollection",features:gj.reduce(function(a,g){return a.concat(g.features||[])},[])};
    if(layer){map.removeLayer(layer);map.layerCtl.removeLayer(layer);}
    layer=L.geoJSON(gj,{
      style:function(f){return{color:"#1b2333",weight:1,fillColor:fillOf(f.properties&&f.properties[FIELD]),fillOpacity:.6};},
      onEachFeature:function(f,l){
        l.bindPopup(function(){return buildPopup(f.properties)},{className:"mm-pop",minWidth:260,maxWidth:260});
        var t=f.properties&&f.properties[LABEL];
        if(t!=null&&t!=="")l.bindTooltip(String(t),{permanent:true,direction:"center",className:"mm-lbl"});
      }
    }).addTo(map);
    map.layerCtl.addOverlay(layer,"ร่างผังเมืองรวม");
    loaded=true;
    fit();
    updLabels();
    var p=gj.features.length&&gj.features[0].properties;
    if(p&&!(FIELD in p))console.warn("ไม่พบคอลัมน์ "+FIELD+" (มี: "+Object.keys(p).join(", ")+")");
  }
  function fromBuffer(buf){
    return shp(buf).then(showData).catch(function(e){alert("อ่านไฟล์ shapefile ไม่ได้: "+e.message)});
  }
  /* ถ้าโหลด .zip อัตโนมัติไม่ได้ (เช่น เปิดแบบ file://) ให้มีปุ่มเลือกไฟล์บนแผนที่ */
  function addPicker(){
    var C=L.Control.extend({options:{position:"topleft"},onAdd:function(){
      var d=L.DomUtil.create("div","mm-picker leaflet-bar"),
          i=L.DomUtil.create("input","",d);
      i.type="file";i.accept=".zip";
      i.onchange=function(){
        var f=i.files[0];if(!f)return;
        var r=new FileReader();
        r.onload=function(){fromBuffer(r.result).then(function(){map.removeControl(ctl)})};
        r.readAsArrayBuffer(f);
      };
      L.DomEvent.disableClickPropagation(d);
      return d;
    }});
    var ctl=new C();ctl.addTo(map);
  }
  function fromUrl(){
    return fetch(ZIP_URL).then(function(r){if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})
      .then(fromBuffer)
      .catch(function(e){console.warn("โหลด "+ZIP_URL+" ไม่ได้",e);addPicker();});
  }

  /* ---------- label: ซ่อนเมื่อซูมออกไกล ---------- */
  function updLabels(){
    box.querySelector(".mm-map").classList.toggle("mm-showlbl",map.getZoom()>=LABEL_MIN_ZOOM);
  }

  /* ---------- ค้นหาจาก lat, long ---------- */
  var searchLayer;
  function ringHas(ring,lat,lng){   // ray casting
    var c=false,i,j;
    for(i=0,j=ring.length-1;i<ring.length;j=i++){
      var a=ring[i],b=ring[j];
      if((a.lat>lat)!==(b.lat>lat)&&lng<(b.lng-a.lng)*(lat-a.lat)/(b.lat-a.lat)+a.lng)c=!c;
    }
    return c;
  }
  function polyHas(rings,lat,lng){  // rings[0]=ขอบนอก ที่เหลือ=รู
    if(!rings.length||!ringHas(rings[0],lat,lng))return false;
    for(var i=1;i<rings.length;i++)if(ringHas(rings[i],lat,lng))return false;
    return true;
  }
  function layerHas(l,lat,lng){
    var ll=l.getLatLngs&&l.getLatLngs();
    if(!ll||!ll.length)return false;
    if(ll[0].lat!==undefined)return ringHas(ll,lat,lng);                  // ring เดี่ยว
    if(ll[0][0]&&ll[0][0].lat!==undefined)return polyHas(ll,lat,lng);     // Polygon
    return ll.some(function(p){return polyHas(p,lat,lng)});              // MultiPolygon
  }
  function num(inp){
    var m=inp.value.replace(/[°\s]/g,"").match(/^-?\d+(?:\.\d+)?$/);
    return m?+m[0]:NaN;
  }
  function parsePair(s){   // "14.59, 101.01" / "14.59 101.01" -> [lat,lng] หรือ null
    var m=String(s).replace(/°/g," ").match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    return m?[+m[1],+m[2]]:null;
  }
  function doSearch(lat,lng,ia,io){   // ia/io = ช่องที่จะขึ้นกรอบแดงเมื่อค่าผิด (โหมดช่องเดียวใช้ช่องเดียวกัน)
    var bad=[];
    if(!(Math.abs(lat)<=90))bad.push(ia);
    if(!(Math.abs(lng)<=180))bad.push(io);
    if(bad.length){
      bad.forEach(function(i){i.classList.add("err");setTimeout(function(){i.classList.remove("err")},1500)});
      return;
    }
    searchLayer.clearLayers();
    var pt=L.latLng(lat,lng);
    L.marker(pt).addTo(searchLayer);
    focusAt(pt,17);
  }
  /* ซูมไปที่จุด และถ้าจุดอยู่ในพื้นที่ของ feature ใดให้เปิด popup ของ feature นั้น */
  function focusAt(pt,zoom){
    map.setView(pt,Math.max(map.getZoom(),zoom));
    if(layer){
      var hit=null;
      layer.eachLayer(function(l){if(!hit&&layerHas(l,pt.lat,pt.lng))hit=l});
      if(hit)hit.openPopup(pt);
    }
  }

  /* ---------- ตำแหน่งปัจจุบัน (ปุ่มใต้ปุ่มซูมออก) ---------- */
  var locLayer;
  function addLocate(){
    locLayer=L.layerGroup().addTo(map);
    var C=L.Control.extend({options:{position:"topleft"},onAdd:function(){
      var d=L.DomUtil.create("div","leaflet-bar leaflet-control"),
          a=L.DomUtil.create("a","mm-loc",d);
      a.href="#";a.setAttribute("role","button");a.title="แสดงตำแหน่งปัจจุบัน";a.setAttribute("aria-label","แสดงตำแหน่งปัจจุบัน");
      a.textContent="𖦏";
      a.onclick=function(e){
        e.preventDefault();
        if(!navigator.geolocation){alert("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");return;}
        a.classList.add("busy");
        navigator.geolocation.getCurrentPosition(function(pos){
          a.classList.remove("busy");
          var pt=L.latLng(pos.coords.latitude,pos.coords.longitude),acc=pos.coords.accuracy||0;
          locLayer.clearLayers();
          if(acc>0)L.circle(pt,{radius:acc,color:"#2563eb",weight:1,fillColor:"#2563eb",fillOpacity:.12,interactive:false}).addTo(locLayer);
          L.circleMarker(pt,{radius:7,color:"#fff",weight:2,fillColor:"#2563eb",fillOpacity:1}).addTo(locLayer);
          focusAt(pt,acc>300?15:17);
        },function(err){
          a.classList.remove("busy");
          alert("ระบุตำแหน่งปัจจุบันไม่ได้: "+(err.code===1?"ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง":err.message||"ไม่ทราบสาเหตุ"));
        },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
      };
      L.DomEvent.disableClickPropagation(d);
      return d;
    }});
    new C().addTo(map);
  }
  function addSearch(){
    searchLayer=L.layerGroup().addTo(map);
    var C=L.Control.extend({options:{position:"topleft"},onAdd:function(){
      var d=L.DomUtil.create("div","mm-search leaflet-bar");
      d.innerHTML='<button type="button" class="tg" title="ย่อเครื่องมือค้นหา">ย่อ</button>'+
        '<div class="bd"><div class="ins"><input type="text" inputmode="decimal" class="la" placeholder="lat" aria-label="Latitude">'+
        '<input type="text" inputmode="decimal" class="lo" placeholder="long" aria-label="Longitude">'+
        '<input type="text" class="ll" placeholder="lat, long เช่น 14.59, 101.01" aria-label="lat, long"></div>'+
        '<div class="btns"><button type="button" class="go" title="ค้นหา">🔍</button>'+
        '<button type="button" class="sw" title="สลับ: แยก lat/long 2 ช่อง ↔ ช่องเดียว">⇄</button>'+
        '<button type="button" class="clr" title="ล้างผลการค้นหา">💫ล้างผลค้นหา</button></div></div>';
      var ia=d.querySelector(".la"),io=d.querySelector(".lo"),il=d.querySelector(".ll");
      var tg=d.querySelector(".tg");
      tg.onclick=function(){   // ขยายอยู่: แสดง ◀ (กดเพื่อย่อ) · ย่ออยู่: แสดง 📍 (กดเพื่อขยาย)
        var c=d.classList.toggle("col");
        tg.textContent=c?"📍":"ย่อ";
        tg.title=c?"ขยายเครื่องมือค้นหา":"ย่อเครื่องมือค้นหา";
      };
      function run(){
        if(d.classList.contains("one")){
          var p=parsePair(il.value);
          if(!p){il.classList.add("err");setTimeout(function(){il.classList.remove("err")},1500);return;}
          doSearch(p[0],p[1],il,il);
        }else doSearch(num(ia),num(io),ia,io);
      }
      d.querySelector(".go").onclick=run;
      d.querySelector(".sw").onclick=function(){   // สลับโหมด พร้อมแปลงค่าที่กรอกไว้
        if(d.classList.contains("one")){
          var p=parsePair(il.value);if(p){ia.value=p[0];io.value=p[1];}
          d.classList.remove("one");
        }else{
          if(ia.value||io.value)il.value=ia.value.trim()+", "+io.value.trim();
          d.classList.add("one");
        }
      };
      d.querySelector(".clr").onclick=function(){ia.value="";io.value="";il.value="";searchLayer.clearLayers();if(locLayer)locLayer.clearLayers();map.closePopup();};
      [ia,io,il].forEach(function(i){i.onkeydown=function(e){if(e.key==="Enter")run()}});
      L.DomEvent.disableClickPropagation(d);L.DomEvent.disableScrollPropagation(d);
      return d;
    }});
    new C().addTo(map);
  }

  /* ---------- สร้าง popup + แผนที่ ---------- */
  function build(){
    back=document.createElement("div");back.className="mm-back hide";
    back.innerHTML='<div class="mm-box"><div class="mm-head"><h3>🗺️ เลือกโซนสีจากแผนที่</h3><button type="button" class="mm-fs" title="ขยายเต็มหน้า" aria-label="ขยายเต็มหน้า">⛶</button><button type="button" class="mm-x" aria-label="ปิด">✕</button></div>'+
      '<div class="mm-map"></div>'+
      '<p class="mm-warn"><b><i>* <u>อยู่ระหว่างศึกษา</u> รายละเอียดตามข้อกำหนดฉบับปิดประกาศ 15 วัน (28 พ.ย. – 12 ต.ค. 69)</i></b></p></div>';
    document.body.appendChild(back);
    box=back.firstChild;
    box.querySelector(".mm-x").onclick=close;
    var fs=box.querySelector(".mm-fs");
    fs.onclick=function(){   // สลับ เต็มหน้า ↔ ขนาดเริ่มต้น
      var f=back.classList.toggle("full");
      fs.textContent=f?"🗗":"⛶";
      fs.title=f?"ย่อกลับขนาดเดิม":"ขยายเต็มหน้า";
      setTimeout(function(){map.invalidateSize();},50);
    };
    back.addEventListener("mousedown",function(e){if(e.target===back)close()});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!back.classList.contains("hide"))close()});
    map=L.map(box.querySelector(".mm-map"),{zoomControl:false,maxZoom:18}).setView([14.59,101.0],11);
    var osm=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);
    var sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:18,attribution:"Esri"});
    map.layerCtl=L.control.layers({"แผนที่":osm,"ดาวเทียม":sat},{}).addTo(map);
    addSearch();                       // เพิ่มก่อน zoom control เพื่อให้อยู่ด้านบน
    L.control.zoom({position:"topleft"}).addTo(map);
    addLocate();                       // เพิ่มหลัง zoom control เพื่อให้อยู่ใต้ปุ่มซูมออก
    map.on("zoomend",updLabels);updLabels();
    built=true;
  }

  function close(){if(back)back.classList.add("hide");}
  function open(){
    var p=(window.L&&window.shp)?Promise.resolve():
      (loadCss(LEAFLET+"leaflet.css"),Promise.all([loadJs(LEAFLET+"leaflet.js"),loadJs(SHPJS)]));
    p.then(function(){
      if(!built)build();
      back.classList.remove("hide");
      setTimeout(fit,80);   // รอให้ popup แสดงเต็มก่อน แล้วค่อย fitBounds ทุกครั้งที่เปิด
      if(!loaded&&!loading){loading=true;fromUrl().then(function(){loading=false});}
    }).catch(function(e){alert("โหลดไลบรารีแผนที่ไม่ได้ (ต้องใช้อินเทอร์เน็ต)\n"+e.message)});
  }

  $("mapBtn").onclick=open;
})();
