# Pricing & Configurable Economics

All packages are commercial concepts, NOT a confirmed client quotation.

| Package | Fee design | Boundary |
| --- | --- | --- |
| 60-day pilot | Agreed scope, support and fair-use budget | One evaluation cohort, not system capacity |
| LUMA Intelligence | Platform + included active learners + marginal active users + AI usage policy | External Hotmart remains |
| Enterprise | Defined isolation, governance, support and evidence-backed availability | SLO and support must be proven and contracted |
| Optional Commerce + Intelligence | Platform + Stripe costs + optional negotiated transaction fee + AI | Direct checkout needs extra implementation |

## Executable model

`src/lib/commerce/economics.ts` implements a provider comparison with exactly supplied inputs, never assumed customer rates. The `docs/enterprise/commerce-scenario.inputs.example.json` template deliberately has `null` for unknown inputs and FAILS until supplied.

```bash
node scripts/commerce-scenario.mjs /path/to/private-scenario.json
```

Inputs: `program_price`, `number_of_sales`, `hotmart_effective_fee_pct`, `stripe_effective_fee_pct`, `luma_platform_fee`, `luma_commerce_platform_fee`, `luma_transaction_fee_pct`, `stripe_fixed_fee_per_sale`, `refund_rate_pct`, `chargeback_rate_pct`, `currency`.

Outputs: `gross_revenue`, `payment_cost`, `platform_cost`, `net_revenue` for Hotmart only, Hotmart+LUMA, Stripe+LUMA; deltas and conditional break-even. Calculated values are **ESTIMATED under explicit user inputs**, not proven savings.

**Model assumptions:** Refunds and chargebacks do not overlap, percentage fees accrue on gross captured sales, fixed platform fees cover the same period. Taxes, settlement timing, additional chargeback fees, FX, affiliate costs, AI/voice/storage variable costs and support are excluded unless incorporated in a confirmed effective fee or evaluated separately. Request actual negotiated terms and operational responsibilities before a sales decision.
