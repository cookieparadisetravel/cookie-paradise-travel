"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Heart, MapPin, Pause, Play, SlidersHorizontal, Upload, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { landscapes, quotes, type WorkspacePhoto } from "./content";

const preferenceKey="cookie-paradise-owner-workspace-v1";
type Preferences={landscape?:string;photo?:string;playing?:boolean;focus?:boolean};
function saved():Preferences{try{return JSON.parse(localStorage.getItem(preferenceKey)||"{}");}catch{return {};}}
function remember(change:Preferences){try{localStorage.setItem(preferenceKey,JSON.stringify({...saved(),...change}));}catch{/* Preferences are optional. */}}
type Context={photos:WorkspacePhoto[];landscapeIndex:number;photoIndex:number;quoteIndex:number;playing:boolean;focus:boolean;reduced:boolean;togglePlaying:()=>void;toggleFocus:()=>void;advancePhotos:(step:number)=>void;advanceQuote:(step:number)=>void;openPersonalize:()=>void;chooseLandscape:(index:number)=>void;choosePhoto:(index:number)=>void};
const WorkspaceContext=createContext<Context|null>(null);
export function useWorkspace(){const value=useContext(WorkspaceContext);if(!value)throw new Error("Missing workspace provider");return value;}
const wrap=(index:number,length:number)=>(index+length)%length;
const preload=(src:string)=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=reject;image.src=src;});

export function WorkspaceProvider({children,initialPhotos}:{children:ReactNode;initialPhotos:WorkspacePhoto[]}){
  const pathname=usePathname();
  const [photos,setPhotos]=useState(initialPhotos),[landscapeIndex,setLandscapeIndex]=useState(0),[photoIndex,setPhotoIndex]=useState(0),[quoteIndex,setQuoteIndex]=useState(0);
  const [playing,setPlaying]=useState(false),[focus,setFocus]=useState(false),[reduced,setReduced]=useState(false),[ready,setReady]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false),[album,setAlbum]=useState("vietnam"),[status,setStatus]=useState(""),[uploading,setUploading]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),importInput=useRef<HTMLInputElement>(null);
  const epoch=useRef(0),photoTime=useRef(0),quoteTime=useRef(0),busy=useRef(false);
  useEffect(()=>{
    const preference=saved(),motion=matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(motion.matches);setPlaying(typeof preference.playing==="boolean"?preference.playing:!motion.matches);setFocus(preference.focus===true);
    setLandscapeIndex(Math.max(0,landscapes.findIndex(item=>item.id===preference.landscape)));
    setPhotoIndex(Math.max(0,initialPhotos.findIndex(item=>item.id===preference.photo)));setReady(true);
    const change=()=>{setReduced(motion.matches);if(motion.matches){setPlaying(false);epoch.current++;}};
    motion.addEventListener("change",change);return()=>motion.removeEventListener("change",change);
  },[]); // Read preferences once; live data refreshes must not restart the slideshow.
  useEffect(()=>{if(settingsOpen&&!dialog.current?.open)dialog.current?.showModal();},[settingsOpen]);
  useEffect(()=>{epoch.current++;busy.current=false;photoTime.current=0;quoteTime.current=0;},[pathname,playing,focus,settingsOpen]);
  const advancePhotos=useCallback(async(step:number)=>{
    photoTime.current=0;const request=++epoch.current;busy.current=true;
    const nextLandscape=wrap(landscapeIndex+step,landscapes.length),nextPhoto=photos.length?wrap(photoIndex+step,photos.length):0;
    try{
      await Promise.all([preload(landscapes[nextLandscape].src),...(photos.length?[preload(photos[nextPhoto].src)]:[])]);
      if(request!==epoch.current)return;setLandscapeIndex(nextLandscape);setPhotoIndex(nextPhoto);
    }catch{/* Preserve the current pair if a photo cannot be loaded. */}
    finally{if(request===epoch.current)busy.current=false;}
  },[landscapeIndex,photoIndex,photos]);
  const advanceQuote=useCallback((step:number)=>{quoteTime.current=0;setQuoteIndex(current=>wrap(current+step,quotes.length));},[]);
  useEffect(()=>{
    if(!ready||!playing||settingsOpen||(focus&&pathname!=="/admin/inspiration")||!document.querySelector('[data-photo-slides],[data-quote-slides]'))return;
    let last=performance.now();
    const timer=setInterval(()=>{
      const now=performance.now(),elapsed=Math.min(now-last,1000);last=now;
      if(document.hidden||document.querySelector('dialog[open],[role="dialog"]'))return;
      const engaged=(selector:string)=>{const node=document.querySelector(selector);return !node||node.matches(":hover")||node.contains(document.activeElement);};
      if(!busy.current&&!engaged('[data-photo-slides]')){photoTime.current+=elapsed;if(photoTime.current>=15000)void advancePhotos(1);}
      if(!engaged('[data-quote-slides]')){quoteTime.current+=elapsed;if(quoteTime.current>=20000)advanceQuote(1);}
    },500);return()=>clearInterval(timer);
  },[ready,playing,settingsOpen,pathname,focus,advancePhotos,advanceQuote]);
  function togglePlaying(){const next=!playing;epoch.current++;busy.current=false;setPlaying(next);remember({playing:next});}
  function toggleFocus(){const next=!focus;setFocus(next);remember({focus:next});}
  function chooseLandscape(index:number){epoch.current++;busy.current=false;photoTime.current=0;setLandscapeIndex(index);remember({landscape:landscapes[index].id});}
  function choosePhoto(index:number){epoch.current++;busy.current=false;photoTime.current=0;setPhotoIndex(index);remember({photo:photos[index].id});}
  async function uploadFiles(files:FileList|null,isImport=false){
    if(!files?.length||uploading)return;setUploading(true);setStatus("Preparing your photos…");
    try{
      type UploadPhoto={id:string;title:string;alt:string;position:string;data:string};let items:UploadPhoto[]=[];
      if(isImport){
        if(files[0].size>40_000_000)throw new Error("This collection is too large.");
        const imported=JSON.parse(await files[0].text());
        if(imported.version!==1||!Array.isArray(imported.photos)||imported.photos.length>50)throw new Error("Choose a workspace photo collection.");
        items=imported.photos;
      }else{
        for(const file of Array.from(files)){
          if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>20_000_000)throw new Error("Choose JPG, PNG, or WebP photos under 20 MB.");
          const bitmap=await createImageBitmap(file),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
          const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
          items.push({id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,"").slice(0,100),alt:"Your personal workspace photograph",position:"50% 35%",data:canvas.toDataURL("image/webp",.88).split(",")[1]});
        }
      }
      let count=0;
      for(const item of items){
        setStatus(`Saving photo ${count+1} of ${items.length}…`);
        const response=await fetch("/api/admin/workspace/photos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item)});
        const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"A photo could not be saved.");count++;
      }
      const response=await fetch("/api/admin/workspace/photos",{cache:"no-store"});if(!response.ok)throw new Error("Photos saved. Refresh to view your collection.");
      const result=await response.json() as {photos:WorkspacePhoto[]};setPhotos(result.photos);setPhotoIndex(0);setAlbum("children");setStatus(`${count} ${count===1?"photo":"photos"} added to your private collection.`);
    }catch(error){setStatus(error instanceof Error?error.message:"Your photos could not be saved.");}
    finally{setUploading(false);if(input.current)input.current.value="";if(importInput.current)importInput.current.value="";}
  }
  const value={photos,landscapeIndex,photoIndex,quoteIndex,playing,focus,reduced,togglePlaying,toggleFocus,advancePhotos:(step:number)=>void advancePhotos(step),advanceQuote,openPersonalize:()=>{setStatus("");setSettingsOpen(true);},chooseLandscape,choosePhoto};
  return <WorkspaceContext.Provider value={value}>{children}
    <dialog className="ws-settings" ref={dialog} onClose={()=>setSettingsOpen(false)} onCancel={()=>setSettingsOpen(false)} aria-labelledby="ws-settings-title">
      <div className="ws-dialog-heading"><div><p className="ws-eyebrow">MAKE IT YOURS</p><h2 id="ws-settings-title">Your place to work.</h2></div><button type="button" className="ws-icon" aria-label="Close personalization" onClick={()=>dialog.current?.close()}><X/></button></div>
      <nav className="ws-tabs" aria-label="Personalization albums"><button type="button" aria-pressed={album==="vietnam"} onClick={()=>setAlbum("vietnam")}>Vietnam</button><button type="button" aria-pressed={album==="children"} onClick={()=>setAlbum("children")}>My children</button></nav>
      <p className="ws-muted ws-small">Choose the photos your workspace opens with.</p>
      <div className="ws-photo-options">{album==="vietnam"?landscapes.map((photo,index)=><button type="button" key={photo.id} aria-pressed={index===landscapeIndex} onClick={()=>chooseLandscape(index)}><img src={photo.src} alt={photo.alt} loading="lazy"/><span>{photo.name}</span></button>):photos.map((photo,index)=><button type="button" key={photo.id} aria-pressed={index===photoIndex} onClick={()=>choosePhoto(index)}><img src={photo.src} alt={photo.alt} style={{objectPosition:photo.position}} loading="lazy"/><span>{photo.title}</span></button>)}</div>
      {album==="children"&&<div className="ws-upload"><p className="ws-small ws-muted">Your personal photos are visible only when signed in to this admin.</p><div className="ws-button-row"><button type="button" className="ws-button" disabled={uploading} onClick={()=>input.current?.click()}><Upload size={15}/> Add photos</button><button type="button" className="ws-text-button" disabled={uploading} onClick={()=>importInput.current?.click()}>Import collection</button></div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event=>void uploadFiles(event.target.files)}/><input ref={importInput} type="file" accept="application/json,.json" hidden onChange={event=>void uploadFiles(event.target.files,true)}/></div>}
      <p className="ws-small ws-upload-status" role="status">{status}</p>
    </dialog>
  </WorkspaceContext.Provider>;
}

export function PersonalizeButton(){const workspace=useWorkspace();return <button type="button" className="ws-button" aria-label="Personalize" onClick={workspace.openPersonalize}><SlidersHorizontal size={16}/><span>Personalize</span></button>;}
function PlaybackButton(){const {playing,togglePlaying}=useWorkspace();return <button type="button" className="ws-icon" onClick={togglePlaying} aria-label={playing?"Pause slideshow":"Play slideshow"} title={playing?"Pause slideshow":"Play slideshow"}>{playing?<Pause/>:<Play/>}</button>;}
export function PhotoSlideshow(){
  const {photos,landscapeIndex,photoIndex,playing,advancePhotos,openPersonalize}=useWorkspace(),landscape=landscapes[landscapeIndex],photo=photos[photoIndex];
  return <section className="ws-photo-slideshow ws-inspiration-element" aria-label="Your children and Vietnam" aria-live="off" data-photo-slides>
    <div className="ws-hero-grid"><div className="ws-landscape"><img className="ws-fade" key={landscape.id} src={landscape.src} alt={landscape.alt} fetchPriority="high"/><div className="ws-hero-copy"><span className="ws-hero-tag">ROOTED IN VIETNAM. BUILT WITH LOVE.</span><div><h2 lang="vi">Vì các con.<br/>Vì Việt Nam.</h2><p>A future for your children.<br/>A connection to the country you love.</p></div><a className="ws-location" href={landscape.url} target="_blank" rel="noopener noreferrer"><MapPin size={12}/><span>{landscape.name}, Vietnam <small>· {landscape.credit}</small></span></a></div></div>
      <div className="ws-family-card">{photo?<div className="ws-family-image"><img className="ws-fade" key={photo.id} src={photo.src} alt={photo.alt} style={{objectPosition:photo.position}}/><span className="ws-heart"><Heart size={14}/></span></div>:<div className="ws-family-empty"><Heart size={27}/><p>For their future.</p><button type="button" onClick={openPersonalize}>Add your children’s photos</button></div>}<div className="ws-family-caption"><h3>The reason behind it all.</h3><p>Keep what matters close.</p></div></div>
    </div><div className="ws-playback"><span>{playing?"Slideshow on":"Slideshow paused"}</span><div><button type="button" className="ws-icon" onClick={()=>advancePhotos(-1)} aria-label="Previous photos"><ChevronLeft/></button><PlaybackButton/><button type="button" className="ws-icon" onClick={()=>advancePhotos(1)} aria-label="Next photos"><ChevronRight/></button></div></div>
  </section>;
}
export function QuoteSlideshow(){const {quoteIndex,advanceQuote}=useWorkspace(),quote=quotes[quoteIndex];return <section className="ws-quote ws-inspiration-element" aria-label="Inspiring quotes" aria-live="off" data-quote-slides><span className="ws-quote-mark" aria-hidden="true">“</span><blockquote className="ws-fade" key={quoteIndex} lang={quote.lang}>{quote.text}</blockquote><div className="ws-quote-bottom"><div><p lang={quote.lang}>{quote.author}</p><a href={quote.source} target="_blank" rel="noopener noreferrer" aria-label={`Quote source: ${quote.label}`}>Source ↗</a></div><div className="ws-quote-controls"><span aria-label={`Quote ${quoteIndex+1} of ${quotes.length}`}>{quoteIndex+1} / {quotes.length}</span><button type="button" className="ws-icon" aria-label="Previous quote" onClick={()=>advanceQuote(-1)}><ChevronLeft/></button><PlaybackButton/><button type="button" className="ws-icon" aria-label="Next quote" onClick={()=>advanceQuote(1)}><ChevronRight/></button></div></div></section>;}
export function InspirationGallery(){const [album,setAlbum]=useState("vietnam"),{photos,chooseLandscape,choosePhoto,openPersonalize}=useWorkspace();return <><nav className="ws-tabs" aria-label="Photo albums"><button type="button" aria-pressed={album==="vietnam"} onClick={()=>setAlbum("vietnam")}>Vietnam <small>{landscapes.length}</small></button><button type="button" aria-pressed={album==="children"} onClick={()=>setAlbum("children")}>My children <small>{photos.length}</small></button></nav><div className="ws-gallery">{album==="vietnam"?landscapes.map((photo,index)=><article key={photo.id}><button type="button" onClick={()=>chooseLandscape(index)} aria-label={`Use ${photo.name} as the opening landscape`}><img src={photo.src} alt={photo.alt} loading="lazy"/></button><div><h3>{photo.name}</h3><a href={photo.url} target="_blank" rel="noopener noreferrer">Photo: {photo.credit} ↗</a></div></article>):photos.map((photo,index)=><article key={photo.id}><button type="button" onClick={()=>choosePhoto(index)} aria-label={`Use ${photo.title} as the opening photo`}><img src={photo.src} alt={photo.alt} style={{objectPosition:photo.position}} loading="lazy"/></button><div><h3>{photo.title}</h3></div></article>)}</div>{album==="children"&&!photos.length&&<button className="ws-button" onClick={openPersonalize}>Add your children’s photos</button>}</>;}
