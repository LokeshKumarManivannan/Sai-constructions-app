# Roadmap and decisions

The main goal: every rupee in and out of the bank is explained (who, which site, what for, bill), so the
income-tax filing is backed by records and no payment is left as "unknown".

## Decided (Nov 2026)

| Topic | Decision |
| --- | --- |
| Bank connection | No direct link today. The business runs on an ICICI **savings** account; ICICI API banking needs a current account, and the RBI Account Aggregator network only serves regulated entities (FIUs). |
| Business account | Plan to open a separate ICICI **current account** for the business, so every transaction in it is business. Confirm the account type and name with the CA. Enables ICICI Connected Banking / API statement fetch later. |
| Bank capture | Monthly statement upload (all accounts) + Android SMS reading (owner's phone is Android). Both feed one bank inbox; duplicates counted once. |
| Notifications | In-app only for now (bell, owner and customer). Phone push / WhatsApp later. |
| Extra work | Approved extra work adds to the total: shown as "contract + extra work". No separate payment request. |
| Labour acknowledgements | Parked. Options kept: WhatsApp receipt with "I received" link; signed/thumb-printed voucher photo; weekly wage sheet. |

## Next: bank inbox and matching

1. **Bank inbox**: one list of bank transactions (date, amount, in/out, narration, UTR/UPI ref, counterparty, source).
   Dedup on date + amount + reference.
2. **Matching**: each transaction is matched to an existing Money paid / Money received entry by amount, date and
   reference. Unmatched ones ask the owner: Business (who, which site, what for → creates the entry) or Personal
   (excluded from the books; needed while the savings account is shared).
3. **Payee memory**: a UPI ID / account seen once maps to the same payee and category next time.
4. **Site codes**: each project gets a short code (e.g. TAM). A code in the UPI remark ("TAM cement") files the
   payment under that site automatically. Otherwise the payee's last site is suggested.
5. **Customer credits**: matched by sender name and amount to the customer's next stage payment.
6. **Reminders** (in the bell): 1st–5th of each month "Upload last month's ICICI statement"; always
   "N bank entries not explained"; home shows "This month: X of Y bank entries explained".
7. **ICICI statement reader** (Excel). Blocked on a sample statement (heading rows and columns intact).
8. **Android SMS reader**: native build installed directly (Play Store restricts SMS reading). Needs 2–3 sample
   ICICI debit/credit SMS.

## Also noted

- Warn before recording a cash payment above ₹10,000 to one person in a day (₹35,000 for transporters):
  it is not allowed as a business expense. Confirm with the CA under the new Income-tax Act.
- Owner-side finance gaps to consider after the bank inbox: budget per site vs actual, supplier credit (bills
  payable), weekly labour wages, overhead share per site.
