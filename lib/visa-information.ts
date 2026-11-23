import { z } from "zod";

export type VisaField = { key:string; label:string; type?:"date"|"email"|"tel"|"textarea"; required?:boolean; options?:string[]; hint?:string; when?:string };
export type VisaSection = { title:string; description?:string; fields:VisaField[] };
const yesNo = ["No", "Yes"];
export const visaSections:VisaSection[] = [
  {title:"Personal information",description:"Use your passport’s spelling, including all given and middle names.",fields:[
    {key:"surname",label:"Surname / family name",hint:"Leave blank only if your passport has no surname."},
    {key:"givenNames",label:"Given names (including middle names)",required:true},
    {key:"dateOfBirth",label:"Date of birth",type:"date",required:true},
    {key:"placeOfBirth",label:"Place of birth",required:true},
    {key:"sex",label:"Sex as shown on passport",options:["Female","Male","X / other"],required:true},
    {key:"nationality",label:"Current nationality",required:true},
    {key:"nationalityAtBirth",label:"Nationality at birth",required:true},
    {key:"religion",label:"Religion",required:true,hint:'Enter “None” if you do not have a religion.'},
    {key:"email",label:"Email",type:"email",required:true},
    {key:"phone",label:"Telephone (include country code)",type:"tel",required:true},
    {key:"multipleNationalities",label:"Do you have more than one nationality?",options:yesNo,required:true},
    {key:"multipleNationalitiesDetails",label:"Other nationalities",type:"textarea",when:"multipleNationalities"},
  ]},
  {title:"Passport information",fields:[
    {key:"passportType",label:"Passport type",options:["Ordinary","Diplomatic","Official","Other"],required:true},
    {key:"passportNumber",label:"Passport number",required:true},
    {key:"passportAuthority",label:"Issuing authority / place of issue",required:true},
    {key:"passportIssueDate",label:"Date of issue",type:"date",required:true},
    {key:"passportExpiryDate",label:"Expiry date",type:"date",required:true},
    {key:"otherPassports",label:"Do you hold another valid passport?",options:yesNo,required:true},
    {key:"otherPassportsDetails",label:"Other passport details",type:"textarea",when:"otherPassports",hint:"For each: nationality, passport type and number, issuing authority, issue date and expiry date."},
    {key:"previousPassport",label:"Have you entered Vietnam using a different passport?",options:yesNo,required:true},
    {key:"previousPassportDetails",label:"Previous passport details",type:"textarea",when:"previousPassport",hint:"Passport number, full name, nationality and date of birth used."},
  ]},
  {title:"Contact & emergency contact",fields:[
    {key:"homeAddress",label:"Permanent residential address",type:"textarea",required:true,hint:"Include city, state/province, postal code and country."},
    {key:"contactAddress",label:"Contact address, if different",type:"textarea"},
    {key:"emergencyName",label:"Emergency contact’s full name",required:true},
    {key:"emergencyRelationship",label:"Relationship to you",required:true},
    {key:"emergencyPhone",label:"Emergency contact’s telephone",type:"tel",required:true},
    {key:"emergencyAddress",label:"Emergency contact’s residential address",type:"textarea",required:true},
  ]},
  {title:"Occupation",fields:[
    {key:"occupation",label:"Occupation",options:["Employee","Business owner","Retired","Student","Unemployed","Government official","Other"],required:true},
    {key:"employer",label:"Company / agency / school name"},
    {key:"position",label:"Position / course of study"},
    {key:"employerAddress",label:"Company / school address",type:"textarea"},
    {key:"employerPhone",label:"Company / school telephone",type:"tel"},
  ]},
  {title:"Your plans in Vietnam",description:"Dates may be provisional. Trung will confirm the visa validity dates, entry and exit points, and accommodation before applying. Leave details blank if they are not arranged yet.",fields:[
    {key:"plannedArrival",label:"Planned arrival in Vietnam",type:"date"},
    {key:"plannedDeparture",label:"Planned departure from Vietnam",type:"date"},
    {key:"datesConfirmed",label:"Are your travel dates confirmed?",options:["Not yet","Yes"],required:true},
    {key:"entries",label:"Will you leave Vietnam and return during this trip?",options:["No — single entry","Yes — multiple entries","Not sure yet"],required:true},
    {key:"entryPort",label:"Planned arrival airport / border crossing"},
    {key:"exitPort",label:"Planned departure airport / border crossing"},
    {key:"vietnamAddress",label:"Accommodation address in Vietnam, if known",type:"textarea"},
    {key:"vietnamProvince",label:"Province / city"},
    {key:"vietnamWard",label:"Ward / commune"},
    {key:"vietnamPhone",label:"Telephone in Vietnam, if known",type:"tel"},
    {key:"tripNotes",label:"Early arrival, extensions or other travel plans",type:"textarea"},
  ]},
  {title:"Previous visits & other information",fields:[
    {key:"recentVisits",label:"Have you visited Vietnam within the past year?",options:yesNo,required:true},
    {key:"recentVisitsDetails",label:"Dates and purpose of each visit",type:"textarea",when:"recentVisits"},
    {key:"relatives",label:"Do you have relatives currently living in Vietnam?",options:yesNo,required:true},
    {key:"relativesDetails",label:"Relatives in Vietnam",type:"textarea",when:"relatives",hint:"For each: full name, date of birth, nationality, relationship and address."},
    {key:"violations",label:"Have you violated Vietnamese laws or regulations?",options:yesNo,required:true},
    {key:"violationsDetails",label:"Details of the violation",type:"textarea",when:"violations",hint:"What happened, date, penalty and the authority involved."},
    {key:"accompanyingChildren",label:"Are any children under 14 included in your passport and traveling with you?",options:yesNo,required:true},
    {key:"accompanyingChildrenDetails",label:"Children included in your passport",type:"textarea",when:"accompanyingChildren",hint:"Full names, dates of birth and sex. Trung will follow up for portraits. Children with their own passports need separate forms."},
  ]},
  {title:"Trip expenses & insurance",fields:[
    {key:"expenses",label:"Estimated trip expenses (USD), if known"},
    {key:"payer",label:"Who will cover your trip expenses?",required:true,hint:"For example: myself, spouse, employer."},
    {key:"insurance",label:"Have you arranged insurance covering your stay in Vietnam?",options:["Yes","No","Not yet"],required:true},
    {key:"insuranceDetails",label:"Insurance provider, policy number and coverage dates",type:"textarea",when:"insurance"},
  ]},
];
export const visaFields = visaSections.flatMap(section=>section.fields);
export const MAX_VISA_IMAGE_BYTES=1_500_000;
export const MAX_VISA_REQUEST_BYTES=3_100_000;
export const visaHeaders = {"Cache-Control":"private, no-store", "Referrer-Policy":"no-referrer", "X-Robots-Tag":"noindex, nofollow", "X-Content-Type-Options":"nosniff", "Cross-Origin-Resource-Policy":"same-origin"};
export const visaPayloadSchema=z.object({
  answers:z.object(Object.fromEntries(visaFields.map(f=>[f.key,z.string().trim().max(f.type==="textarea"?3000:250).optional().default("")]))).strict(),
  consent:z.literal(true),
}).strict().superRefine(({answers},ctx)=>{
  for(const field of visaFields){
    const value=answers[field.key];
    const required=field.required || (field.when && answers[field.when]==="Yes");
    if(required&&!value)ctx.addIssue({code:"custom",path:["answers",field.key],message:`Please complete: ${field.label}.`});
    if(value&&field.options&&!field.options.includes(value))ctx.addIssue({code:"custom",path:["answers",field.key],message:`Choose an option for ${field.label}.`});
    if(value&&field.type==="date"&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))ctx.addIssue({code:"custom",path:["answers",field.key],message:`Enter a valid date for ${field.label}.`});
    if(value&&field.type==="email"&&!z.string().email().safeParse(value).success)ctx.addIssue({code:"custom",path:["answers",field.key],message:"Enter a valid email address."});
  }
  const issue=(key:string,message:string)=>ctx.addIssue({code:"custom",path:["answers",key],message});
  if(answers.dateOfBirth>new Date().toISOString().slice(0,10))issue("dateOfBirth","Date of birth cannot be in the future.");
  if(answers.passportIssueDate>new Date().toISOString().slice(0,10))issue("passportIssueDate","Passport issue date cannot be in the future.");
  if(answers.passportExpiryDate<new Date().toISOString().slice(0,10))issue("passportExpiryDate","This passport has expired. Please contact Trung before submitting.");
  if(answers.plannedDeparture&&answers.passportExpiryDate<answers.plannedDeparture)issue("passportExpiryDate","The passport expires before your planned departure. Please contact Trung.");
  if(answers.passportExpiryDate<=answers.passportIssueDate)issue("passportExpiryDate","Passport expiry must be after its issue date.");
  if(answers.plannedArrival&&answers.plannedDeparture&&answers.plannedDeparture<answers.plannedArrival)issue("plannedDeparture","Departure must be on or after arrival.");
  if(answers.datesConfirmed==="Yes"&&(!answers.plannedArrival||!answers.plannedDeparture))issue("plannedArrival","Enter both confirmed travel dates.");
});
export type VisaAnswers=Record<string,string>;
export function isVisaToken(token:string){return /^[a-f0-9]{64}$/.test(token);}
export async function hashVisaToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,"0")).join("");}
export function newVisaToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");}
export function visaImageType(bytes:Uint8Array){
  if(bytes.length<12||bytes.length>MAX_VISA_IMAGE_BYTES)return null;
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return "image/png";
  if(String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return "image/webp";
  return null;
}
export function sameVisaOrigin(request:Request){return request.headers.get("Origin")===new URL(request.url).origin;}
export async function boundedVisaBody(request:Request,max:number){
  if(Number(request.headers.get("content-length"))>max)throw new Error("too_large");
  const reader=request.body?.getReader(); if(!reader)throw new Error("empty");
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new Error("too_large");}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
