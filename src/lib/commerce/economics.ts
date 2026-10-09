/**
 * Configurable commercial comparison, not a claim about a merchant contract.
 * All rates, volumes and fixed costs are supplied by the caller.
 * Explicit assumptions: refunds and chargebacks are non-overlapping shares of
 * captured gross; provider fees are charged on gross processed volume and are
 * not recovered on refunds; no dispute fixed fees, taxes, FX or settlement
 * delays are included unless separately incorporated in effective fees.
 */
export interface CommerceEconomicsInput {
  currency: string;
  program_price: number;
  number_of_sales: number;
  hotmart_effective_fee_pct: number;
  stripe_effective_fee_pct: number;
  luma_platform_fee: number;
  luma_commerce_platform_fee: number;
  luma_transaction_fee_pct: number;
  stripe_fixed_fee_per_sale: number;
  refund_rate_pct: number;
  chargeback_rate_pct: number;
}

export interface CommerceEconomicsScenario {
  gross_revenue: number;
  refunded_revenue: number;
  chargeback_revenue: number;
  retained_revenue: number;
  payment_cost: number;
  platform_cost: number;
  net_revenue: number;
}

export interface CommerceEconomicsResult {
  currency: string;
  assumptions: string[];
  hotmart_only: CommerceEconomicsScenario;
  luma_intelligence: CommerceEconomicsScenario;
  luma_commerce_direct: CommerceEconomicsScenario;
  delta_direct_vs_hotmart: number;
  delta_direct_vs_intelligence: number;
  break_even_sales_direct_vs_intelligence: number | null;
}

function validateMoney(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`FINANCE_INVALID_${key.toUpperCase()}`);
  }
  return value;
}

function validatePercent(value: unknown, key: string): number {
  const percent = validateMoney(value, key);
  if (percent > 100) throw new Error(`FINANCE_INVALID_${key.toUpperCase()}`);
  return percent / 100;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function evaluateCommerceEconomics(
  input: CommerceEconomicsInput,
): CommerceEconomicsResult {
  if (!input || typeof input !== "object") {
    throw new Error("FINANCE_INPUT_REQUIRED");
  }
  if (typeof input.currency !== "string" ||
      !/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error("FINANCE_INVALID_CURRENCY");
  }
  const price = validateMoney(input.program_price, "program_price");
  const sales = validateMoney(input.number_of_sales, "number_of_sales");
  if (!Number.isSafeInteger(sales)) throw new Error("FINANCE_INVALID_NUMBER_OF_SALES");
  const hotmart = validatePercent(input.hotmart_effective_fee_pct, "hotmart_effective_fee_pct");
  const stripe = validatePercent(input.stripe_effective_fee_pct, "stripe_effective_fee_pct");
  const intelligenceFee = validateMoney(input.luma_platform_fee, "luma_platform_fee");
  const commerceFee = validateMoney(input.luma_commerce_platform_fee, "luma_commerce_platform_fee");
  const lumaTransaction = validatePercent(input.luma_transaction_fee_pct, "luma_transaction_fee_pct");
  const fixedStripe = validateMoney(input.stripe_fixed_fee_per_sale, "stripe_fixed_fee_per_sale");
  const refundedPct = validatePercent(input.refund_rate_pct, "refund_rate_pct");
  const chargebackPct = validatePercent(input.chargeback_rate_pct, "chargeback_rate_pct");
  if (refundedPct + chargebackPct > 1) {
    throw new Error("FINANCE_REFUND_AND_CHARGEBACK_OVERLAP");
  }

  const gross = price * sales;
  const refunds = gross * refundedPct;
  const chargebacks = gross * chargebackPct;
  const retained = gross - refunds - chargebacks;
  if (![gross, refunds, chargebacks, retained].every(Number.isFinite)) {
    throw new Error("FINANCE_ARITHMETIC_OVERFLOW");
  }

  const scenario = (rate: number, fixedPerSale: number, platformFee: number,
    transactionRate: number): CommerceEconomicsScenario => {
    const paymentCost = gross * rate + fixedPerSale * sales;
    const platformCost = platformFee + gross * transactionRate;
    const net = retained - paymentCost - platformCost;
    if (![paymentCost, platformCost, net].every(Number.isFinite)) {
      throw new Error("FINANCE_ARITHMETIC_OVERFLOW");
    }
    return {
      gross_revenue: round(gross),
      refunded_revenue: round(refunds),
      chargeback_revenue: round(chargebacks),
      retained_revenue: round(retained),
      payment_cost: round(paymentCost),
      platform_cost: round(platformCost),
      net_revenue: round(net),
    };
  };

  const hotmartOnly = scenario(hotmart, 0, 0, 0);
  const intelligence = scenario(hotmart, 0, intelligenceFee, 0);
  const direct = scenario(stripe, fixedStripe, commerceFee, lumaTransaction);
  const savingsPerSale = price * (hotmart - stripe - lumaTransaction) - fixedStripe;
  const incrementalFixed = commerceFee - intelligenceFee;
  let breakEven: number | null = null;
  if (savingsPerSale > 0) {
    const threshold = Math.max(0, Math.ceil(incrementalFixed / savingsPerSale));
    breakEven = Number.isSafeInteger(threshold) ? threshold : null;
  } else if (incrementalFixed <= 0) {
    breakEven = 0; // At volume 0 direct does not cost more; may lose that advantage as sales grow.
  }

  return {
    currency: input.currency,
    assumptions: [
      "All merchant effective fees are supplied inputs, not published list prices.",
      "Refunds and chargebacks are non-overlapping fractions of gross sales.",
      "Processor percentage fees apply to gross captured sales, including refunded sales.",
      "Additional dispute fees, taxes, FX, support, AI variable costs and settlement timing are excluded.",
      "Break-even means direct commerce reaches parity with Hotmart plus LUMA Intelligence under these assumptions; zero can indicate parity only before sales.",
    ],
    hotmart_only: hotmartOnly,
    luma_intelligence: intelligence,
    luma_commerce_direct: direct,
    delta_direct_vs_hotmart: round(direct.net_revenue - hotmartOnly.net_revenue),
    delta_direct_vs_intelligence: round(direct.net_revenue - intelligence.net_revenue),
    break_even_sales_direct_vs_intelligence: breakEven,
  };
}
