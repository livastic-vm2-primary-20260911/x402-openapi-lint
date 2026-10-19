/**
 * Original deterministic CSV integrity preflight. No customer cell values
 * are returned, persisted, fetched, executed, or sent to another API here.
 * Structural QA only: not truth, safety, or regulatory certification.
 */
import {createHash} from "node:crypto";
export const CSV_LIMITS=Object.freeze({
  maxUtf8Bytes:32768,maxRows:500,maxColumns:40,
  maxCellChars:4096,maxExpectedColumns:40,maxIssueExamples:20
});
export const DEMO_CSV=[
  "email,amount,date,note",
  "a@example.com,12.5,2026-10-19,paid",
  "a@example.com,12.5,2026-10-19,paid",
  "bad-email,not-a-number,2026-13-99,=1+1",
  "b@example.com,,2026-10-20, pending ",
  "c@example.com,22.1,2026-10-21"
].join("\n");
const fail=reason=>({ok:false,reason});
function allowedText(text) {
  return typeof text==="string"&&Buffer.byteLength(text,"utf8")<=CSV_LIMITS.maxUtf8Bytes;
}
function allowedExpected(list) {
  return Array.isArray(list)&&list.length<=CSV_LIMITS.maxExpectedColumns&&
    list.every(v=>typeof v==="string"&&v.length>0&&v.length<=100);
}
function parseCsv(text) {
  // 0=start, 1=unquoted, 2=quoted, 3=after quoted close.
  const rows=[];let row=[],cell="",mode=0;
  function addCell(){
    if(cell.length>CSV_LIMITS.maxCellChars)throw Error("CSV cell exceeds 4096 characters");
    row.push(cell);cell="";
    if(row.length>CSV_LIMITS.maxColumns)throw Error("CSV exceeds 40 columns");
  }
  function addRow(){
    addCell();rows.push(row);row=[];
    if(rows.length>CSV_LIMITS.maxRows+1)throw Error("CSV exceeds 500 data rows");
  }
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(mode===2){
      if(c==='"'){
        if(text[i+1]==='"'){cell+='"';i++;}
        else mode=3;
      }else cell+=c;
    }else if(c===","){addCell();mode=0;}
    else if(c==="\r"||c==="\n"){
      if(c==="\r"&&text[i+1]==="\n")i++;
      addRow();mode=0;
    }else if(c==='"'){
      if(mode!==0)throw Error("Unexpected quote inside unquoted CSV field");
      mode=2;
    }else{
      if(mode===3)throw Error("Characters after closing quoted CSV field");
      mode=1;cell+=c;
    }
    if(cell.length>CSV_LIMITS.maxCellChars)throw Error("CSV cell exceeds 4096 characters");
  }
  if(mode===2)throw Error("Unclosed quoted CSV field");
  if(cell.length||row.length||mode===3)addRow();
  return rows;
}
const normalize=s=>String(s).trim().toLowerCase().replace(/\s+/g," ");
const email=s=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const numeric=s=>/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s);
const isoDate=s=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const [yr,m,d]=s.split("-").map(Number);
  const dt=new Date(Date.UTC(yr,m-1,d));
  return dt.getUTCFullYear()===yr&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d;
};
const formula=s=>/^[=+@]/.test(s)||(/^-/.test(s)&&!numeric(s));
const headerText=(s,i)=>{
  const clean=String(s).replace(/[\x00-\x1f\x7f]/g,"").trim();
  return clean.length>80?clean.slice(0,80)+"…":(clean||"column_"+(i+1));
};
const columnHint=name=>{
  if(/(^|[_ -])(?:e-?mail|email_address)(?:$|[_ -])/.test(name))return "email";
  if(/(?:^|[_ -])(?:amount|price|quantity|total|qty|cost|balance)(?:$|[_ -])/.test(name))return "number";
  if(/(?:^|[_ -])(?:date|birth_date|due_date|created_at)(?:$|[_ -])/.test(name))return "date";
  return "mixed";
};
export function validateCsvInput(data){
  if(!data||typeof data!=="object"||Array.isArray(data)||
     !Object.keys(data).every(k=>["csvText","expectedColumns"].includes(k))||
     typeof data.csvText!=="string"||data.csvText.length===0||
     !allowedText(data.csvText)||data.csvText.includes("\u0000")){
    return fail("Provide JSON {csvText:string,expectedColumns?:string[]} <=32KB UTF-8, no NUL.");
  }
  if(data.expectedColumns!==undefined&&!allowedExpected(data.expectedColumns)){
    return fail("expectedColumns must contain <=40 nonempty headings <=100 chars each.");
  }
  return {ok:true};
}
export function inspectCsv(data){
  const input=validateCsvInput(data);if(!input.ok)return input;
  let rows;
  try{rows=parseCsv(data.csvText.replace(/^\uFEFF/,""));}
  catch(error){return fail(error.message);}
  if(!rows.length||rows[0].length<1)return fail("CSV header row required.");
  if(rows[0].length>CSV_LIMITS.maxColumns||rows.length-1>CSV_LIMITS.maxRows)
    return fail("CSV row/column limit exceeded.");
  const headers=rows[0],width=headers.length,expected=data.expectedColumns||[];
  const cols=headers.map((raw,i)=>({
    index:i,header:headerText(raw,i),hint:columnHint(normalize(raw)),
    empty:0,missing:0,trimmedWhitespace:0,
    formulaRiskCells:0,typeMismatches:0,
    possibleEmailFields:0,numericFields:0,isoDates:0
  }));
  const warnings=[],anomalies=[],seenHeaders=new Set();
  for(let i=0;i<headers.length;i++){
    const h=normalize(headers[i]);
    if(!h)warnings.push("Blank header at column "+(i+1)+".");
    if(h&&seenHeaders.has(h))warnings.push("Repeated normalized header at column "+(i+1)+".");
    seenHeaders.add(h);
  }
  const expectedMissing=expected.filter(name=>!seenHeaders.has(normalize(name))).length;
  if(expectedMissing)warnings.push(expectedMissing+" required headers missing.");
  let irregularRows=0,duplicates=0,formulaRiskCells=0,totalEmpty=0,
    typeMismatch=0,trimmedWhitespace=0;
  const seenRows=new Set();
  for(let r=1;r<rows.length;r++){
    const values=rows[r];
    if(values.length!==width){
      irregularRows++;
      if(anomalies.length<CSV_LIMITS.maxIssueExamples)
        anomalies.push({row:r+1,type:"column_count",expected:width,observed:values.length});
    }
    const canonical=JSON.stringify(values.map(s=>String(s).trim()));
    const digest=createHash("sha256").update(canonical).digest("hex");
    if(seenRows.has(digest)){
      duplicates++;
      if(anomalies.length<CSV_LIMITS.maxIssueExamples)
        anomalies.push({row:r+1,type:"duplicate_row",details:"Previously seen normalized row, values withheld."});
    }else seenRows.add(digest);
    for(let c=0;c<width;c++){
      const col=cols[c];
      if(c>=values.length){col.missing++;col.empty++;totalEmpty++;continue;}
      const raw=values[c],cell=raw.trim();
      if(!cell){col.empty++;totalEmpty++;}
      if(raw!==cell){col.trimmedWhitespace++;trimmedWhitespace++;}
      if(cell&&formula(cell)){
        col.formulaRiskCells++;formulaRiskCells++;
        if(anomalies.length<CSV_LIMITS.maxIssueExamples)
          anomalies.push({row:r+1,column:c+1,type:"spreadsheet_formula_injection_risk"});
      }
      if(cell){
        if(email(cell))col.possibleEmailFields++;
        if(numeric(cell))col.numericFields++;
        if(isoDate(cell))col.isoDates++;
        if((col.hint==="email"&&!email(cell))||
           (col.hint==="number"&&!numeric(cell))||
           (col.hint==="date"&&!isoDate(cell))){
          col.typeMismatches++;typeMismatch++;
          if(anomalies.length<CSV_LIMITS.maxIssueExamples)
            anomalies.push({row:r+1,column:c+1,type:col.hint+"_format_warning"});
        }
      }
    }
  }
  if(irregularRows)warnings.push(irregularRows+" rows have unexpected column counts.");
  if(duplicates)warnings.push(duplicates+" duplicate normalized rows.");
  if(typeMismatch)warnings.push(typeMismatch+" possible data format mismatches.");
  if(formulaRiskCells)warnings.push(formulaRiskCells+" spreadsheet formula-risk cells.");
  if(trimmedWhitespace)warnings.push(trimmedWhitespace+" whitespace-affected cells.");
  if(totalEmpty)warnings.push(totalEmpty+" blank or missing expected cells.");
  return {
    ok:true,kind:"csv_structure_quality_preflight",reportVersion:"1.0",
    inputUTF8Bytes:Buffer.byteLength(data.csvText,"utf8"),
    headerColumns:width,dataRows:rows.length-1,
    irregularRows,normalizedDuplicateRows:duplicates,blankOrMissingCells:totalEmpty,
    formatWarnings:typeMismatch,spreadsheetFormulaRiskCells:formulaRiskCells,
    whitespaceAffectedCells:trimmedWhitespace,
    expectedHeadersCount:expected.length,missingExpectedHeaderCount:expectedMissing,
    columns:cols,issues:anomalies,warnings,
    passedBasicStructure:irregularRows===0&&duplicates===0&&formulaRiskCells===0&&
      typeMismatch===0&&warnings.length===0,
    noRawDataReturned:true,
    limitations:"Heuristic structural QA only. Never executes formulas, proves source data truth, validates all spreadsheet implementations or certifies security/GDPR. Caller owns submitted data and must exclude secrets. Server does not persist cells, but proxies, infrastructure and facilitators have independent logging. Response includes sanitized header labels."
  };
}
