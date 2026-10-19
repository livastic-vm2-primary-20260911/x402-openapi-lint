import test from "node:test";
import assert from "node:assert/strict";
import {inspectCsv,validateCsvInput,DEMO_CSV,CSV_LIMITS} from "../csv-preflight.mjs";
test("Original synthetic demand-matched CSV catches multiple real structural issues",()=>{
 const x=inspectCsv({csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]});
 assert.equal(x.ok,true);assert.equal(x.dataRows,5);assert.equal(x.headerColumns,4);
 assert.equal(x.irregularRows,1);assert.equal(x.normalizedDuplicateRows,1);
 assert.equal(x.spreadsheetFormulaRiskCells,1);assert.equal(x.formatWarnings,3);
 assert.equal(x.passedBasicStructure,false);assert.equal(x.noRawDataReturned,true);
 assert.equal(x.missingExpectedHeaderCount,0);
 assert.ok(x.issues.every(i=>!JSON.stringify(i).includes("a@example.com")));
});
test("Real typed CSV with dates numbers and emails passes accurate basic structure",()=>{
 const x=inspectCsv({csvText:"email,amount,date\nalpha@example.com,-34.22,2026-10-18\nbeta@example.org,0,2026-10-19\n"});
 assert.equal(x.ok,true);assert.equal(x.passedBasicStructure,true);
 assert.equal(x.formatWarnings,0);assert.equal(x.spreadsheetFormulaRiskCells,0);
 assert.equal(x.dataRows,2);
});
test("Quoted commas, CRLF, escaped quotes, quoted newline and Unicode parse correctly",()=>{
 const text='user,note,amount\r\n"서울, Alice","This has ""escaped"" quotes\nand newline",3.14\r\n';
 const x=inspectCsv({csvText:text});
 assert.equal(x.ok,true);assert.equal(x.irregularRows,0);
 assert.equal(x.dataRows,1);assert.equal(x.headerColumns,3);
 assert.equal(x.passedBasicStructure,true);
 assert.equal(JSON.stringify(x).includes("Alice"),false);
 assert.equal(JSON.stringify(x).includes("This has"),false);
});
test("Reject malformed quoted cells instead of charging for garbage",()=>{
 for(const text of ['a,b\n"oops,1','a,b\nx"unexpected,1','a,b\n"x"abc,2']){
  const x=inspectCsv({csvText:text});
  assert.equal(x.ok,false,text);
 }
});
test("Reject too large inputs and too many fields and rows before payment",()=>{
 assert.equal(validateCsvInput({csvText:"A".repeat(CSV_LIMITS.maxUtf8Bytes+1)}).ok,false);
 let x=inspectCsv({csvText:Array(42).fill("cell").join(",")+"\n"});
 assert.equal(x.ok,false);
 x=inspectCsv({csvText:"column\n"+Array(502).fill("cell").join("\n")});
 assert.equal(x.ok,false);
});
test("Reject NUL and non-CSV structures before payment",()=>{
 for(const x of [{},{csvText:null},{csvText:34},{csvText:""},{csvText:"a\0b\n1"},{csvText:"a,b",other:"secret"},{csvText:"a,b",expectedColumns:[1]},{csvText:"a,b",expectedColumns:["x".repeat(101)]}]){
  assert.equal(inspectCsv(x).ok,false,JSON.stringify(x));
 }
});
test("Normalize duplicate column names and report missing expected headings",()=>{
 const x=inspectCsv({csvText:"Email,email, price\nx,y,5",expectedColumns:["email","price","foo"]});
 assert.equal(x.ok,true);
 assert.ok(x.warnings.some(s=>s.includes("Repeated normalized header")));
 assert.equal(x.missingExpectedHeaderCount,1);
});
test("Distinguish leading '-' negative numeric from unsafe spreadsheet commands",()=>{
 const x=inspectCsv({csvText:"amount,note\n-42,-hidden-command\n+6,=SUM(A1:A9)\n"});
 assert.equal(x.ok,true);
 assert.equal(x.spreadsheetFormulaRiskCells,3); // +6 is numeric but starts with spreadsheet formula prefix
 assert.equal(x.formatWarnings,0);
});
test("Malformed date February 30 rejected as heuristic error without exposing actual cell",()=>{
 const x=inspectCsv({csvText:"date,amount\n2026-02-30,22.0\n"});
 assert.equal(x.ok,true);assert.equal(x.formatWarnings,1);
 assert.equal(JSON.stringify(x).includes("2026-02-30"),false);
});
test("Blank rows and missing row cells are warnings, not syntactically invalid CSV",()=>{
 const x=inspectCsv({csvText:"id,email\n1,x@y.com\n\n2,y@z.org"});
 assert.equal(x.ok,true);
 assert.ok(x.irregularRows>0);
 assert.ok(x.blankOrMissingCells>0);
});
test("Distinct CSV rows with normalized whitespace count as duplicates",()=>{
 const x=inspectCsv({csvText:"id,name\n01,Alice\n 01,Alice \n"});
 assert.equal(x.ok,true);assert.equal(x.normalizedDuplicateRows,1);
});
test("Input size limit uses UTF8 bytes (not number of UTF16 characters)",()=>{
 assert.equal(validateCsvInput({csvText:"가".repeat(11000)}).ok,false);
});
