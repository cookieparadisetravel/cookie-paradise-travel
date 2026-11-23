import { boundedVisaBody, MAX_VISA_REQUEST_BYTES, sameVisaOrigin, visaHeaders, visaImageType, visaPayloadSchema } from "@/lib/visa-information";
import { resolveVisaRequest, submitVisaInformation, visaRequestState } from "@/lib/visa-information-storage";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:visaHeaders});
const token=(request:Request)=>request.headers.get("Authorization")?.replace(/^Bearer /,"")||"";
export async function GET(request:Request){
  try{
    const record=await resolveVisaRequest(token(request)),state=visaRequestState(record);
    if(state!=="ready"||!record)return json({state},state==="completed"?200:410);
    // Deliberately never return submitted answers, passport numbers, or documents to a link holder.
    return json({state,name:`${record.first_name} ${record.last_name}`,departure:record.departure,expiresAt:record.expires_at});
  }catch{return json({error:"The form is temporarily unavailable. Please try again."},503);}
}
export async function POST(request:Request){
  if(!sameVisaOrigin(request))return json({error:"Please submit this form from our website."},403);
  try{
    const record=await resolveVisaRequest(token(request));
    if(!record||visaRequestState(record)!=="ready")return json({error:"This link has expired, was replaced, or has already been used. Please contact Trung for a new link."},410);
    const bytes=await boundedVisaBody(request,MAX_VISA_REQUEST_BYTES);
    let form:FormData;
    try{form=await new Response(bytes,{headers:{"Content-Type":request.headers.get("Content-Type")||""}}).formData();}catch{return json({error:"The form could not be read. Please try again."},400);}
    let raw:unknown;try{raw=JSON.parse(String(form.get("payload")));}catch{return json({error:"Please complete the form."},400);}
    const parsed=visaPayloadSchema.safeParse(raw);
    if(!parsed.success)return json({error:parsed.error.issues[0]?.message||"Please check the form."},400);
    const images=[];
    for(const kind of ["passport","portrait"]){const file=form.get(kind);if(!(file instanceof File))return json({error:`Please upload your ${kind} image.`},400);const image=new Uint8Array(await file.arrayBuffer()),mime=visaImageType(image);if(!mime)return json({error:"Upload clear JPG, PNG or WebP images, each no larger than 1.5 MB."},400);images.push({kind,mime,bytes:image});}
    const answers={...parsed.data.answers};for(const field of Object.keys(answers)){if(field.endsWith("Details")&&answers[field.replace(/Details$/,"")]!=="Yes")answers[field]="";}
    if(!await submitVisaInformation(record,answers,images))return json({error:"This link has already been used or replaced. Please contact Trung if you need a correction."},409);
    return json({state:"completed"});
  }catch(error){return json({error:error instanceof Error&&error.message==="too_large"?"The upload is too large. Please use smaller images.":"Your information could not be saved. Please try again."},error instanceof Error&&error.message==="too_large"?413:503);}
}
