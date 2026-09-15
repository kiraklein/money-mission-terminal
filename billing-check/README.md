# Klein Billing Check

Working local CSV billing reconciliation software by **Klein Consulting Ltd**.

Compare billable usage with flat per-unit prices and net invoice lines. Export potential underbilling, potential overbilling, missing rates and unmatched records. This is a self-service early release, not a managed audit or a native Stripe integration.

## Download and start

[Download Klein-Billing-Check.html](https://github.com/kiraklein/money-mission-terminal/raw/refs/heads/main/billing-check/dist/Klein-Billing-Check.html)

Save the downloaded HTML file locally and open it in a current desktop browser. Select **Try example data** for a complete worked example. No installation, account or network access is needed for analysis. Download all three example CSV files from **Data format** and replace their example rows with your own records.

## Data contract

Required headers are case sensitive:

| File | Required columns |
| --- | --- |
| Usage | event_id, customer_id, meter, period, currency, quantity |
| Pricing | customer_id, meter, currency, unit_price, included_units |
| Invoice lines | invoice_line_id, customer_id, meter, period, currency, amount |

Period is the service month YYYY-MM, not the invoice issue date. Unit price is the major-currency price per ONE unit (convert per-million-token prices before use). Use * as customer_id for a default price or an exact ID for an override. Included units apply once per customer/meter/month/currency. Rates must be unchanged within a month.

Invoice amount is the usage-line subtotal after discounts and before tax, expressed in major currency units (not cents). Sum all relevant invoice and credit-note lines; represent credits as negative amounts. Match the same complete service month and customer/meter IDs across files. Header-only invoice files are supported. Native Stripe exports must be normalised to this schema first.

Flat prices only. Tiered or volume pricing, minimum commitments, per-account credits, partial periods, mid-month rate changes and currency conversion are outside v1. Supported currencies: USD, NZD, AUD, EUR, GBP, CAD, CHF, SGD and HKD. Limits: 6 MB and 100,000 rows per file.

Exact duplicate event/line IDs count once; conflicting duplicate IDs stop the comparison. IDs must be globally unique within each file. Missing prices and invoice lines with no matching usage are excluded from monetary totals. Currencies are never combined. Underbilling and overbilling are not netted against each other. Decimal arithmetic is exact; calculated charges round half up to two decimal places per customer/meter/month/currency.

## Privacy

Files remain in browser memory until cleared or the page closes. No analytics, external scripts, network calls, API keys, account access, cookies or browser storage. Exported files remain on your device. Checkout uses Stripe separately. Never email raw customer records or credentials for support.

## Purchase

[Buy a business licence — US$49 once](https://buy.stripe.com/14A8wP4SMgsf4ZPbyN0sU04)

A perpetual internal-use licence for one business, covering the downloaded version 1.x. No subscription or activation key. Your Stripe receipt proves your licence. Evaluate the software before purchase using the download above.

Read the [licence and seven-day refund terms](LICENCE.md). This release does not include a managed audit, enterprise certification, direct Stripe import or promised savings. Support and refund requests: kiravanklein@gmail.com.

## Development

npm test runs meaningful financial/CSV edge cases. npm run build creates self-contained HTML from the engine, UI and shell. No third-party runtime dependencies.
