import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";

// Inline the logo
const logoB64 = fs.readFileSync("src/assets/ocs-logo.png").toString("base64");

// --- Copy of buildIntakePdf logic, parameterised with mock data ---
const BRAND_NAME = "OCS · On Call Services";
const BRAND_TAGLINE = "Property maintenance · Dispatch operations";
const BRAND_WEB = "ocsportal.co.uk";
const BRAND_EMAIL = "dispatch@ocsportal.co.uk";

function safe(v){ if(v==null) return "—"; if(typeof v==="string") return v||"—"; if(Array.isArray(v)) return v.length?v.join(", "):"—"; return String(v);}
function fmtDateTime(v){ if(!v) return "—"; try{return new Date(v).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"});}catch{return v;}}
function titleCase(s){return s.split(/[_\s]+/).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(" ");}
function formatAddress(ex){const l=[];if(ex.address_line_1) l.push(ex.address_line_1);const c=[ex.city,ex.postcode].filter(Boolean).join("  ");if(c) l.push(c);return l.length?l:["—"];}
function decodeBase64(b){const bin=Buffer.from(b,"base64");return new Uint8Array(bin);}

async function build(r, ex, cat, extras){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic=await pdf.embedFont(StandardFonts.HelveticaOblique);
  let logoImage=null;
  try{logoImage=await pdf.embedPng(decodeBase64(logoB64));}catch{}
  const W=595,H=842,margin=44,contentW=W-margin*2;
  const NAVY=[0.07,0.11,0.20], NAVY_SOFT=[0.16,0.22,0.34], GOLD=[0.78,0.62,0.25];
  const INK=[0.10,0.12,0.16], MUTED=[0.42,0.45,0.52], HAIRLINE=[0.86,0.87,0.90];
  const CARD_BG=[0.975,0.97,0.95], PAGE_BG=[0.99,0.985,0.975];
  let pageNo=0; const pages=[]; let page=newPage(); let y=H-170;
  function newPage(){
    pageNo+=1; const p=pdf.addPage([W,H]); pages.push(p);
    p.drawRectangle({x:0,y:0,width:W,height:H,color:rgb(...PAGE_BG)});
    const headerH=120;
    p.drawRectangle({x:0,y:H-headerH,width:W,height:headerH,color:rgb(...NAVY)});
    p.drawRectangle({x:0,y:H-headerH-4,width:W,height:4,color:rgb(...GOLD)});
    let textX=margin;
    if(logoImage){const logoH=46;const lw=logoImage.width/logoImage.height*logoH;p.drawImage(logoImage,{x:margin,y:H-36-logoH,width:lw,height:logoH});textX=margin+lw+14;}
    p.drawText(BRAND_NAME,{x:textX,y:H-44,size:13,font:bold,color:rgb(1,1,1)});
    p.drawText(BRAND_TAGLINE,{x:textX,y:H-58,size:8.5,font:italic,color:rgb(...GOLD)});
    p.drawText(`Web  ${BRAND_WEB}`,{x:textX,y:H-78,size:8.5,font,color:rgb(0.82,0.86,0.94)});
    p.drawText(`Email  ${BRAND_EMAIL}`,{x:textX,y:H-92,size:8.5,font,color:rgb(0.82,0.86,0.94)});
    p.drawText("WORK ORDER · Intake preview",{x:margin,y:H-112,size:8,font:bold,color:rgb(...GOLD)});
    const ref=safe(ex.order_no??r.source_reference??r.id);
    const refW=bold.widthOfTextAtSize(ref,14);
    p.drawText("REFERENCE",{x:W-margin-Math.max(refW,90),y:H-44,size:8,font:bold,color:rgb(...GOLD)});
    p.drawText(ref,{x:W-margin-refW,y:H-64,size:14,font:bold,color:rgb(1,1,1)});
    const stat=titleCase(safe(r.parse_status));
    const statW=font.widthOfTextAtSize(stat,9);
    p.drawRectangle({x:W-margin-statW-16,y:H-92,width:statW+12,height:16,color:rgb(...GOLD)});
    p.drawText(stat,{x:W-margin-statW-10,y:H-88,size:9,font:bold,color:rgb(...NAVY)});
    return p;
  }
  function ensure(s){if(y-s<60){page=newPage();y=H-170;}}
  function wrapText(t,mw,sz,f=font){
    const out=[];
    const splitTok=(tok)=>{if(f.widthOfTextAtSize(tok,sz)<=mw) return [tok]; const pcs=[]; let cur=""; for(const ch of tok){const test=cur+ch; if(f.widthOfTextAtSize(test,sz)>mw&&cur){pcs.push(cur); cur=ch;} else cur=test;} if(cur) pcs.push(cur); return pcs;};
    for(const para of String(t).split(/\n+/)){
      const raw=para.split(/\s+/); const ws=[]; for(const w of raw) ws.push(...splitTok(w));
      let line=""; for(const w of ws){const test=line?line+" "+w:w; if(f.widthOfTextAtSize(test,sz)>mw&&line){out.push(line); line=w;} else line=test;}
      if(line) out.push(line);
    }
    return out;
  }
  function sectionTitle(label){ensure(34);page.drawRectangle({x:margin,y:y-2,width:22,height:2,color:rgb(...GOLD)});page.drawText(label.toUpperCase(),{x:margin+30,y:y-8,size:10,font:bold,color:rgb(...NAVY_SOFT)});y-=18;page.drawRectangle({x:margin,y,width:contentW,height:0.6,color:rgb(...HAIRLINE)});y-=12;}
  function drawKV(x,yPos,label,value,width,opts){
    const valueSize=opts?.valueSize??10.5; const maxLines=opts?.maxLines??4;
    page.drawText(label.toUpperCase(),{x,y:yPos,size:7.5,font:bold,color:rgb(...MUTED)});
    const lines=wrapText(value||"—",width,valueSize,font).slice(0,maxLines);
    let ly=yPos-13;
    for(const ln of lines){page.drawText(ln,{x,y:ly,size:valueSize,font,color:rgb(...INK)});ly-=valueSize+2.5;}
    return {nextY:ly,height:13+lines.length*(valueSize+2.5)};
  }
  // Hero
  const summary=safe(ex.job_summary);
  const summaryLines=wrapText(summary,contentW-32,13,bold);
  const descLines=ex.job_description?wrapText(safe(ex.job_description),contentW-32,10,font):[];
  const heroH=22+summaryLines.length*16+(descLines.length?8+descLines.length*13:0)+14;
  ensure(heroH+10);
  page.drawRectangle({x:margin,y:y-heroH,width:contentW,height:heroH,color:rgb(...NAVY)});
  page.drawRectangle({x:margin,y:y-heroH,width:4,height:heroH,color:rgb(...GOLD)});
  let hy=y-18;
  page.drawText("JOB SUMMARY",{x:margin+16,y:hy,size:8,font:bold,color:rgb(...GOLD)});
  hy-=18;
  for(const ln of summaryLines){page.drawText(ln,{x:margin+16,y:hy,size:13,font:bold,color:rgb(1,1,1)});hy-=16;}
  if(descLines.length){hy-=4;for(const ln of descLines){page.drawText(ln,{x:margin+16,y:hy,size:10,font,color:rgb(0.82,0.85,0.90)});hy-=13;}}
  y-=heroH+18;

  // Site & dispatch
  sectionTitle("Site & Dispatch");
  const colW=(contentW-12)/2; const rx=margin+colW+12; const pad=12;
  const addrLines=formatAddress(ex);
  const addrInnerW=colW-pad*2;
  const wrappedAddr=[];
  for(const ln of addrLines) wrappedAddr.push(...wrapText(ln,addrInnerW,11,bold));
  const leftH=14+14+wrappedAddr.length*13+pad;
  const dispInnerW=colW-pad*2;
  const halfW=(dispInnerW-10)/2;
  const rowAH=Math.max(13+wrapText(safe(ex.postcode_zone)||"—",halfW,10.5,font).slice(0,2).length*13,13+wrapText(titleCase(safe(cat.priority_level))||"—",halfW,10.5,font).slice(0,2).length*13);
  const rowBH=Math.max(13+wrapText(safe(cat.engineers_required)||"—",halfW,10.5,font).slice(0,2).length*13,13+wrapText(cat.diary_ready?"Yes":"No",halfW,10.5,font).slice(0,2).length*13);
  const rightH=14+rowAH+10+rowBH+pad;
  const sdH=Math.max(leftH,rightH,70);
  ensure(sdH+10); const sdTop=y;
  page.drawRectangle({x:margin,y:y-sdH,width:colW,height:sdH,color:rgb(...CARD_BG)});
  page.drawRectangle({x:margin,y:y-sdH,width:3,height:sdH,color:rgb(...GOLD)});
  page.drawText("SITE ADDRESS",{x:margin+pad,y:y-14,size:7.5,font:bold,color:rgb(...GOLD)});
  { let ay=y-30; for(const ln of wrappedAddr){page.drawText(ln,{x:margin+pad,y:ay,size:11,font:bold,color:rgb(...INK)});ay-=13;} }
  page.drawRectangle({x:rx,y:y-sdH,width:colW,height:sdH,color:rgb(...CARD_BG)});
  page.drawRectangle({x:rx,y:y-sdH,width:3,height:sdH,color:rgb(...GOLD)});
  drawKV(rx+pad,y-14,"Postcode zone",safe(ex.postcode_zone),halfW,{maxLines:2});
  drawKV(rx+pad+halfW+10,y-14,"Priority",titleCase(safe(cat.priority_level)),halfW,{maxLines:2});
  drawKV(rx+pad,y-14-rowAH-10,"Engineers req.",safe(cat.engineers_required),halfW,{maxLines:2});
  drawKV(rx+pad+halfW+10,y-14-rowAH-10,"Diary ready",cat.diary_ready?"Yes":"No",halfW,{maxLines:2});
  y=sdTop-sdH-14;

  sectionTitle("Contacts");
  { const innerW=contentW-pad*2;
    const nameLines=wrapText(safe(ex.contact_name),innerW,12,bold);
    const phoneLines=wrapText(safe(ex.contact_phone),innerW,10.5,font);
    const h=14+nameLines.length*14+4+phoneLines.length*13+pad;
    ensure(h+6); const top=y;
    page.drawRectangle({x:margin,y:y-h,width:contentW,height:h,color:rgb(...CARD_BG)});
    page.drawRectangle({x:margin,y:y-h,width:3,height:h,color:rgb(...GOLD)});
    page.drawText("PRIMARY SITE CONTACT",{x:margin+pad,y:y-14,size:7.5,font:bold,color:rgb(...GOLD)});
    let py=y-28;
    for(const ln of nameLines){page.drawText(ln,{x:margin+pad,y:py,size:12,font:bold,color:rgb(...INK)});py-=14;}
    py-=2;
    for(const ln of phoneLines){page.drawText(ln,{x:margin+pad,y:py,size:10.5,font,color:rgb(...NAVY_SOFT)});py-=13;}
    y=top-h-10;
  }

  { const innerW=colW-pad*2;
    const agencyName=safe(ex.agency_name??ex.client_name);
    const agencyLines=wrapText(agencyName,innerW,12,bold);
    const leftBodyH=agencyLines.length*14;
    const tenantNameLines=wrapText(safe(ex.tenant_name),innerW,12,bold);
    const tenantPhoneLines=wrapText(safe(ex.tenant_phone),innerW,10,font);
    const tenantEmailLines=wrapText(safe(ex.tenant_email),innerW,9.5,font);
    const rightBodyH=tenantNameLines.length*14+2+tenantPhoneLines.length*12+2+tenantEmailLines.length*11;
    const acH=Math.max(14+14+leftBodyH+pad,14+14+rightBodyH+pad,60);
    ensure(acH+6); const acTop=y;
    page.drawRectangle({x:margin,y:y-acH,width:colW,height:acH,color:rgb(...CARD_BG)});
    page.drawRectangle({x:margin,y:y-acH,width:3,height:acH,color:rgb(...GOLD)});
    page.drawText("MANAGING AGENCY",{x:margin+pad,y:y-14,size:7.5,font:bold,color:rgb(...GOLD)});
    { let ly=y-30; for(const ln of agencyLines){page.drawText(ln,{x:margin+pad,y:ly,size:12,font:bold,color:rgb(...INK)});ly-=14;} }
    page.drawRectangle({x:rx,y:y-acH,width:colW,height:acH,color:rgb(...CARD_BG)});
    page.drawRectangle({x:rx,y:y-acH,width:3,height:acH,color:rgb(...GOLD)});
    page.drawText("TENANT / OCCUPIER",{x:rx+pad,y:y-14,size:7.5,font:bold,color:rgb(...GOLD)});
    { let ry=y-30;
      for(const ln of tenantNameLines){page.drawText(ln,{x:rx+pad,y:ry,size:12,font:bold,color:rgb(...INK)});ry-=14;}
      ry-=2;
      for(const ln of tenantPhoneLines){page.drawText(ln,{x:rx+pad,y:ry,size:10,font,color:rgb(...NAVY_SOFT)});ry-=12;}
      ry-=2;
      for(const ln of tenantEmailLines){page.drawText(ln,{x:rx+pad,y:ry,size:9.5,font,color:rgb(...MUTED)});ry-=11;}
    }
    y=acTop-acH-14;
  }

  if(extras.length){
    sectionTitle("Additional contacts");
    const innerW=contentW-pad*2;
    for(const c of extras){
      const role=c.role||"Contact";
      const nameLines=wrapText(safe(c.name),innerW,11,bold);
      const meta=[c.phone,c.email].filter(Boolean).join("  ·  ")||"—";
      const metaLines=wrapText(meta,innerW,9.5,font);
      const lineH=14+nameLines.length*13+2+metaLines.length*12+pad;
      ensure(lineH+6); const top=y;
      page.drawRectangle({x:margin,y:y-lineH,width:contentW,height:lineH,color:rgb(...CARD_BG)});
      page.drawRectangle({x:margin,y:y-lineH,width:3,height:lineH,color:rgb(...GOLD)});
      page.drawText(role.toUpperCase(),{x:margin+pad,y:y-14,size:7.5,font:bold,color:rgb(...GOLD)});
      let cy=y-28;
      for(const ln of nameLines){page.drawText(ln,{x:margin+pad,y:cy,size:11,font:bold,color:rgb(...INK)});cy-=13;}
      cy-=2;
      for(const ln of metaLines){page.drawText(ln,{x:margin+pad,y:cy,size:9.5,font,color:rgb(...NAVY_SOFT)});cy-=12;}
      y=top-lineH-8;
    }
  }

  if(ex.additional_notes){
    sectionTitle("Notes");
    const lines=wrapText(safe(ex.additional_notes),contentW-24,10.5,font);
    const h=16+lines.length*13;
    ensure(h+6); const top=y;
    page.drawRectangle({x:margin,y:y-h,width:contentW,height:h,color:rgb(...CARD_BG)});
    page.drawRectangle({x:margin,y:y-h,width:3,height:h,color:rgb(...GOLD)});
    let ny=y-16;
    for(const ln of lines){page.drawText(ln,{x:margin+12,y:ny,size:10.5,font,color:rgb(...INK)});ny-=13;}
    y=top-h-14;
  }

  sectionTitle("Source");
  { const innerW=contentW-pad*2;
    const cellW=(innerW-16)/2;
    const channel=titleCase(safe(r.source_type));
    const fromStr=safe(r.source_sender);
    const subject=safe(r.source_subject);
    const received=fmtDateTime(r.received_at??r.created_at);
    const rowH=(a,b)=>Math.max(13+wrapText(a,cellW,10.5,font).slice(0,3).length*13,13+wrapText(b,cellW,10.5,font).slice(0,3).length*13);
    const r1=rowH(channel,fromStr);
    const r2=rowH(subject,received);
    const srcH=14+r1+10+r2+pad;
    ensure(srcH+6); const srcTop=y;
    page.drawRectangle({x:margin,y:y-srcH,width:contentW,height:srcH,color:rgb(...CARD_BG)});
    page.drawRectangle({x:margin,y:y-srcH,width:3,height:srcH,color:rgb(...GOLD)});
    drawKV(margin+pad,y-14,"Channel",channel,cellW,{maxLines:3});
    drawKV(margin+pad+cellW+16,y-14,"From",fromStr,cellW,{maxLines:3});
    drawKV(margin+pad,y-14-r1-10,"Subject",subject,cellW,{maxLines:3});
    drawKV(margin+pad+cellW+16,y-14-r1-10,"Received",received,cellW,{maxLines:3});
    y=srcTop-srcH-8;
  }

  // Footer
  const generated=`Generated ${fmtDateTime(new Date().toISOString())}`;
  pages.forEach((p,idx)=>{
    p.drawRectangle({x:margin,y:54,width:contentW,height:0.8,color:rgb(...HAIRLINE)});
    p.drawRectangle({x:margin,y:52,width:22,height:2,color:rgb(...GOLD)});
    p.drawText(BRAND_NAME,{x:margin,y:38,size:8.5,font:bold,color:rgb(...NAVY)});
    p.drawText(`${BRAND_WEB}  ·  ${BRAND_EMAIL}`,{x:margin,y:26,size:8,font,color:rgb(...NAVY_SOFT)});
    p.drawText(generated,{x:margin,y:14,size:7.5,font:italic,color:rgb(...MUTED)});
    const pageStr=`Page ${idx+1} of ${pages.length}`;
    const w=font.widthOfTextAtSize(pageStr,8);
    p.drawText(pageStr,{x:W-margin-w,y:26,size:8,font:bold,color:rgb(...NAVY)});
  });

  return await pdf.save();
}

const r={id:"abc123",source_reference:"OCS-2026-00845",source_type:"email_inbound",source_sender:"dispatch.urgent.escalation.team@verylongagencydomain-managers.co.uk",source_subject:"URGENT — Tenant reports active water leak across two floors, requires immediate plumber dispatch for tonight",received_at:new Date().toISOString(),parse_status:"needs_review"};
const ex={order_no:"OCS-2026-00845",job_summary:"Active water leak from upstairs bathroom flooding the kitchen ceiling below — requires emergency plumber attendance within 2 hours and a follow-up ceiling repair quote.",job_description:"The tenant called at 14:32 stating water was visibly dripping through 4 separate light fittings in the kitchen ceiling. Stop tap has been isolated. Building insurance reference Z-99281 attached. Access via key safe code 4421. Tenant has small children and is currently at a neighbour's flat.",address_line_1:"Flat 14B, The Mansions at Wellington Crescent",city:"Royal Tunbridge Wells",postcode:"TN1 1XQ",postcode_zone:"TN1-South",contact_name:"Mrs. Alexandra Buckingham-Featherstonehaugh",contact_phone:"+44 7700 900123 (mobile, preferred 9–6)",agency_name:"Wellington Crescent Premier Property Management Services Limited",tenant_name:"Mr. Jonathan Pemberton-Hill",tenant_phone:"+44 7700 900456",tenant_email:"jonathan.pemberton.hill.tenant@personalemaildomainprovider.example.com",additional_contacts:[{role:"Building Manager",name:"Patricia O'Sullivan-Whitfield",phone:"+44 1892 555 0199",email:"p.osullivan-whitfield@wellingtoncrescentpremier.co.uk"},{role:"Out of hours",name:"Night Concierge Desk",phone:"+44 1892 555 0100",email:"nightdesk@wellingtoncrescentpremier.co.uk"}],additional_notes:"Tenant has requested a callback before 18:00 with ETA. Please confirm engineer name in advance — building has strict ID checks at reception. Two prior visits this year for the same flat (refs OCS-2026-00112 and OCS-2026-00498)."};
const cat={priority_level:"high_urgency",engineers_required:"1 plumber + 1 ceiling repair (follow-up)",diary_ready:true};

const bytes=await build(r,ex,cat,ex.additional_contacts);
fs.writeFileSync("/tmp/test.pdf",bytes);
console.log("OK", bytes.length);
