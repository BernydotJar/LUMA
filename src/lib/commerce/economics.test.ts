import { describe, expect, it } from "vitest";
import { evaluateCommerceEconomics, type CommerceEconomicsInput } from "./economics";

const inputs: CommerceEconomicsInput = {
  currency: "USD",
  program_price: 2000,
  number_of_sales: 100,
  hotmart_effective_fee_pct: 10,
  stripe_effective_fee_pct: 4,
  luma_platform_fee: 700,
  luma_commerce_platform_fee: 1200,
  luma_transaction_fee_pct: 1,
  stripe_fixed_fee_per_sale: 0,
  refund_rate_pct: 5,
  chargeback_rate_pct: 1,
};

describe("configurable commerce economics", () => {
  it("compares three paths using supplied assumptions, without inventing fees", () => {
    const result = evaluateCommerceEconomics(inputs);
    expect(result.hotmart_only).toMatchObject({
      gross_revenue: 200000,
      refunded_revenue: 10000,
      chargeback_revenue: 2000,
      payment_cost: 20000,
      platform_cost: 0,
      net_revenue: 168000,
    });
    expect(result.luma_intelligence.net_revenue).toBe(167300);
    expect(result.luma_commerce_direct.net_revenue).toBe(176800);
    expect(result.delta_direct_vs_intelligence).toBe(9500);
    expect(result.break_even_sales_direct_vs_intelligence).toBe(5);
  });

  it("does not silently substitute default merchant fees or unknown assumptions", () => {
    expect(() => evaluateCommerceEconomics({
      ...inputs, hotmart_effective_fee_pct: null as unknown as number,
    })).toThrow("FINANCE_INVALID_HOTMART_EFFECTIVE_FEE_PCT");
    expect(() => evaluateCommerceEconomics({
      ...inputs, luma_commerce_platform_fee: undefined as unknown as number,
    })).toThrow("FINANCE_INVALID_LUMA_COMMERCE_PLATFORM_FEE");
  });

  it("rejects overlapping loss rates and invalid volumes", () => {
    expect(() => evaluateCommerceEconomics({
      ...inputs, refund_rate_pct: 60, chargeback_rate_pct: 50,
    })).toThrow("FINANCE_REFUND_AND_CHARGEBACK_OVERLAP");
    expect(() => evaluateCommerceEconomics({
      ...inputs, number_of_sales: 2.5,
    })).toThrow("FINANCE_INVALID_NUMBER_OF_SALES");
  });

  it("keeps break-even unknown when direct fees are never advantageous at scale", () => {
    const result = evaluateCommerceEconomics({
      ...inputs,
      hotmart_effective_fee_pct: 3,
      stripe_effective_fee_pct: 4,
    });
    expect(result.break_even_sales_direct_vs_intelligence).toBeNull();
    expect(result.delta_direct_vs_intelligence).toBeLessThan(0);
  });
});
