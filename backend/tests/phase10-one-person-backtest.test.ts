import assert from "node:assert/strict";
import test, { after } from "node:test";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";

const stamp = Date.now().toString(36);
const email = `phase10.${stamp}@example.com`;
const password = "Phase10@Test123";
const customerNumber = `P10${stamp.toUpperCase()}`;
let userId="",customerId="",accountId="",loanRequestId="",loanId="",loanAccountId="",cardRequestId="",cardId="";
const transactionIds:string[]=[];

after(async()=>{
  if(cardRequestId){await pool.query("DELETE FROM request_status_history WHERE request_type='CARD' AND request_id=$1",[cardRequestId]);await pool.query("DELETE FROM card_requests WHERE card_request_id=$1",[cardRequestId]);}
  if(loanId)await pool.query("DELETE FROM loan_emi_schedules WHERE loan_id=$1",[loanId]);
  if(loanId)await pool.query("DELETE FROM loans WHERE loan_id=$1",[loanId]);
  if(loanRequestId){await pool.query("DELETE FROM request_status_history WHERE request_type='LOAN' AND request_id=$1",[loanRequestId]);await pool.query("DELETE FROM loan_requests WHERE loan_request_id=$1",[loanRequestId]);}
  if(transactionIds.length){await pool.query("DELETE FROM ledger_entries WHERE transaction_id=ANY($1::bigint[])",[transactionIds]);await pool.query("DELETE FROM transaction_details WHERE transaction_id=ANY($1::bigint[])",[transactionIds]);await pool.query("DELETE FROM transaction_status_history WHERE transaction_id=ANY($1::bigint[])",[transactionIds]);await pool.query("DELETE FROM transactions WHERE transaction_id=ANY($1::bigint[])",[transactionIds]);}
  if(cardId)await pool.query("DELETE FROM cards WHERE card_id=$1",[cardId]);
  if(loanAccountId)await pool.query("DELETE FROM accounts WHERE account_id=$1",[loanAccountId]);
  if(accountId)await pool.query("DELETE FROM accounts WHERE account_id=$1",[accountId]);
  if(userId)await pool.query("DELETE FROM audit_logs WHERE user_id=$1 OR (entity IN('LOAN','LOAN_REQUEST','CARD','CARD_REQUEST') AND entity_id=ANY($2::bigint[]))",[userId,[loanId||"0",loanRequestId||"0",cardId||"0",cardRequestId||"0"]]);
  if(customerId)await pool.query("DELETE FROM customers WHERE customer_id=$1",[customerId]);
  if(userId)await pool.query("DELETE FROM users WHERE user_id=$1",[userId]);
  await pool.end();
});

test("one person loan liability and card approval backtest",async()=>{
  const branch=(await pool.query("SELECT branch_id::text FROM branches WHERE status='ACTIVE' ORDER BY branch_id LIMIT 1")).rows[0];assert.ok(branch);
  const hash=await bcrypt.hash(password,10);userId=(await pool.query("INSERT INTO users(email,password_hash,role,status,email_verified,email_verified_at) VALUES($1,$2,'CUSTOMER','ACTIVE',true,now()) RETURNING user_id::text",[email,hash])).rows[0].user_id;
  customerId=(await pool.query("INSERT INTO customers(user_id,branch_id,customer_number,first_name,last_name,email,phone,date_of_birth,customer_status,kyc_status) VALUES($1,$2,$3,'Phase','Ten',$4,$5,'1990-01-01','ACTIVE','VERIFIED') RETURNING customer_id::text",[userId,branch.branch_id,customerNumber,email,`9${Date.now().toString().slice(-9)}`])).rows[0].customer_id;
  accountId=(await pool.query("INSERT INTO accounts(account_number,customer_id,branch_id,account_type,currency,current_balance,available_balance,account_status,opened_at) VALUES($1,$2,$3,'SAVINGS','INR',0,0,'ACTIVE',CURRENT_DATE) RETURNING account_id::text",[`P10${stamp}`.slice(0,20),customerId,branch.branch_id])).rows[0].account_id;
  const login=await request(app).post("/api/v1/auth/login").send({customerId:customerNumber,password});assert.equal(login.status,200);const token=login.body.data.token;const auth={Authorization:`Bearer ${token}`};
  const adminLogin=await request(app).post("/api/v1/auth/login").send({customerId:"ADMINLOCAL0001",password:"PiBank@Admin001"});assert.equal(adminLogin.status,200);const admin={Authorization:`Bearer ${adminLogin.body.data.token}`};
  const deposit=await request(app).post("/api/v1/transactions/deposit").set(auth).send({accountId,amount:300000});assert.equal(deposit.status,201);transactionIds.push(String(deposit.body.data.transaction_id));
  const preview=await request(app).get("/api/v1/loan-requests/preview").set(auth).query({requestedAmount:200000,durationMonths:24});assert.equal(preview.status,200);assert.equal(preview.body.data.interestRate,11);assert.ok(preview.body.data.estimatedEmi>0);
  const created=await request(app).post("/api/v1/loan-requests").set(auth).send({requestedAmount:200000,durationMonths:24,loanType:"PERSONAL",loanSubtype:"UNSECURED_PERSONAL",purpose:"Phase 10 one-person backtest"});assert.equal(created.status,201);loanRequestId=String(created.body.data.loan_request_id);assert.equal(Number(created.body.data.requested_interest_rate),11);
  assert.equal((await request(app).post(`/api/v1/admin/loan-requests/${loanRequestId}/review`).set(admin)).status,200);
  const approved=await request(app).post(`/api/v1/admin/loan-requests/${loanRequestId}/approve`).set(admin).send({approvedAmount:200000,approvedDurationMonths:24});assert.equal(approved.status,200);loanId=String(approved.body.data.loan.loan_id);loanAccountId=String(approved.body.data.loanAccount.account_id);assert.equal(Number(approved.body.data.loan.interest_rate),11);assert.equal(Number(approved.body.data.loanAccount.current_balance),0);
  const savingsBefore=Number((await pool.query("SELECT current_balance::text FROM accounts WHERE account_id=$1",[accountId])).rows[0].current_balance);
  const disbursed=await request(app).post(`/api/v1/admin/loans/${loanId}/disburse`).set(admin).send({});assert.equal(disbursed.status,200);transactionIds.push(String(disbursed.body.data.transaction.transaction_id));
  const disbursementState=(await pool.query("SELECT l.status,l.outstanding_principal::text,a.current_balance::text,a.available_balance::text,(SELECT destination_account_id::text FROM transactions WHERE transaction_id=l.disbursement_transaction_id) destination FROM loans l JOIN accounts a ON a.account_id=l.account_id WHERE l.loan_id=$1",[loanId])).rows[0];assert.deepEqual(disbursementState,{status:"ACTIVE",outstanding_principal:"200000.0000",current_balance:"200000.0000",available_balance:"0.0000",destination:loanAccountId});assert.equal(Number((await pool.query("SELECT current_balance::text FROM accounts WHERE account_id=$1",[accountId])).rows[0].current_balance),savingsBefore);
  const emis=await pool.query("SELECT emi_schedule_id::text,total_emi::text,principal_component::text FROM loan_emi_schedules WHERE loan_id=$1 ORDER BY installment_number",[loanId]);assert.equal(emis.rowCount,24);
  const sourceBefore=Number((await pool.query("SELECT current_balance::text FROM accounts WHERE account_id=$1",[accountId])).rows[0].current_balance);const payment=await request(app).post(`/api/v1/loans/${loanId}/emis/${emis.rows[0].emi_schedule_id}/pay`).set(auth).send({sourceAccountId:accountId});assert.equal(payment.status,201);transactionIds.push(String(payment.body.data.transaction_id));const paidState=(await pool.query("SELECT l.outstanding_principal::text,a.current_balance::text,e.status,e.amount_paid::text FROM loans l JOIN accounts a ON a.account_id=l.account_id JOIN loan_emi_schedules e ON e.loan_id=l.loan_id AND e.installment_number=1 WHERE l.loan_id=$1",[loanId])).rows[0];assert.equal(paidState.status,"PAID");assert.equal(Number(paidState.outstanding_principal),200000-Number(emis.rows[0].principal_component));assert.equal(paidState.current_balance,paidState.outstanding_principal);assert.equal(Number((await pool.query("SELECT current_balance::text FROM accounts WHERE account_id=$1",[accountId])).rows[0].current_balance),sourceBefore-Number(emis.rows[0].total_emi));
  const ledger=await pool.query("SELECT entry_type,amount::text,balance_before::text,balance_after::text FROM ledger_entries WHERE transaction_id=$1",[payment.body.data.transaction_id]);assert.equal(ledger.rowCount,2);for(const row of ledger.rows)assert.equal(Number(row.balance_after),Number(row.balance_before)-Number(row.amount));
  const adminDetail=await request(app).get(`/api/v1/admin/loans/${loanId}`).set(admin);assert.equal(adminDetail.status,200);assert.equal(adminDetail.body.data.emi_schedules.filter((emi:any)=>emi.status==="PAID").length,1);assert.equal(adminDetail.body.data.emi_schedules.filter((emi:any)=>["PENDING","OVERDUE","PARTIALLY_PAID"].includes(emi.status)).length,23);
  const cardCountBefore=Number((await pool.query("SELECT count(*)::int count FROM cards WHERE account_id=$1",[accountId])).rows[0].count);const cardRequest=await request(app).post("/api/v1/card-requests").set(auth).send({accountId,cardType:"DEBIT",notes:"Phase 10 card request"});assert.equal(cardRequest.status,201);cardRequestId=String(cardRequest.body.data.card_request_id);assert.equal(cardRequest.body.data.status,"PENDING");assert.equal(Number((await pool.query("SELECT count(*)::int count FROM cards WHERE account_id=$1",[accountId])).rows[0].count),cardCountBefore);
  assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/review`).set(admin)).status,200);const cardApproval=await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/approve`).set(admin);assert.equal(cardApproval.status,200);cardId=String(cardApproval.body.data.card.card_id);assert.equal(cardApproval.body.data.request.status,"APPROVED");assert.equal((await request(app).get("/api/v1/cards").set(auth)).body.data.some((card:any)=>String(card.cardId)===cardId),true);assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/approve`).set(admin)).status,409);
  const foreclosure=await request(app).post(`/api/v1/loans/${loanId}/foreclose`).set(auth).send({sourceAccountId:accountId});assert.equal(foreclosure.status,201);transactionIds.push(String(foreclosure.body.data.transaction_id));const closed=(await pool.query("SELECT l.status,l.outstanding_principal::text,a.account_status,a.current_balance::text,(SELECT count(*)::int FROM loan_emi_schedules WHERE loan_id=l.loan_id) emi_count FROM loans l JOIN accounts a ON a.account_id=l.account_id WHERE l.loan_id=$1",[loanId])).rows[0];assert.deepEqual(closed,{status:"FORECLOSED",outstanding_principal:"0.0000",account_status:"CLOSED",current_balance:"0.0000",emi_count:24});
});
