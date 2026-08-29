"""
BRAE metrics — single source of truth for valuation identities.
All formulas must match Strategy 2026 Net Reserve / Net Bitcoin Per Share definitions.

Gross mNAV:                    mNAV_gross = market_cap / (btc_held * p_btc)
Enterprise mNAV:               mNAV_ev    = (market_cap + debt + pref_notional - cash) / (btc_held * p_btc)
Senior claims:                 senior_usd = otm_converts_notional + pref_notional - usd_reserve
Net BTC:                       net_btc    = btc_held - senior_usd / p_btc
CEBE per share:                cebe       = net_btc / adso
mNAV CEBE:                     mNAV_cebe  = price / (cebe * p_btc)
BTC per $1 (gross):            btc_per_dollar_gross = btc_held / market_cap
BTC per $1 (CEBE):             btc_per_dollar_cebe  = cebe / price
BTC yield:                     (cebe_now - cebe_prev) / cebe_prev
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import math

@dataclass
class CapitalSnapshot:
    ticker: str
    btc_held: float                  # coins
    p_btc: float                     # USD per BTC
    price: float                     # USD per share (common) or per share/unit (preferred/ETF)
    market_cap: float                # USD (basic shares * price)
    basic_shares: float
    adso: float                      # assumed diluted shares outstanding
    usd_reserve: float = 0.0         # USD cash / reserve
    debt_notional: float = 0.0       # USD notional of debt
    otm_converts_notional: float = 0.0
    pref_notional: float = 0.0       # sum of all preferred notional above common
    cash: float = 0.0                # alias for usd_reserve when computing EV; keep separate for clarity
    holdings_as_of: str = ""
    price_as_of: str = ""

@dataclass
class CEBEResult:
    senior_claims_usd: float
    net_btc: float
    cebe_btc_per_share: float
    mnav_gross: float
    mnav_ev: float
    mnav_cebe: float
    btc_per_dollar_gross: float
    btc_per_dollar_cebe: float
    btc_per_million_gross: float
    btc_per_million_cebe: float

def mnav_gross(market_cap: float, btc_held: float, p_btc: float) -> float:
    """mNAV_gross = market_cap / (btc_held * p_btc)"""
    denom = btc_held * p_btc
    if denom == 0:
        return math.inf if market_cap > 0 else 0.0
    return market_cap / denom

def mnav_ev(market_cap: float, debt: float, pref_notional: float, cash: float, btc_held: float, p_btc: float) -> float:
    """mNAV_ev = (market_cap + debt + pref_notional - cash) / (btc_held * p_btc)"""
    ev = market_cap + debt + pref_notional - cash
    denom = btc_held * p_btc
    if denom == 0:
        return math.inf if ev > 0 else 0.0
    return ev / denom

def senior_claims_usd(otm_converts_notional: float, pref_notional: float, usd_reserve: float) -> float:
    """senior_claims_usd = OTM_converts + pref_notional - usd_reserve"""
    return otm_converts_notional + pref_notional - usd_reserve

def net_btc_coins(btc_held: float, senior_usd: float, p_btc: float) -> float:
    """net_btc = btc_held - senior_usd / p_btc"""
    if p_btc == 0:
        return btc_held
    return btc_held - senior_usd / p_btc

def cebe_per_share(net_btc: float, adso: float) -> float:
    """CEBE = net_btc / ADSO"""
    if adso == 0:
        return 0.0
    return net_btc / adso

def mnav_cebe(price: float, cebe: float, p_btc: float) -> float:
    """mNAV_cebe = price / (cebe * p_btc)"""
    denom = cebe * p_btc
    if denom == 0:
        return math.inf if price > 0 else 0.0
    return price / denom

def btc_per_dollar_gross(btc_held: float, market_cap: float) -> float:
    """BTC per $1 (gross) = btc_held / market_cap"""
    if market_cap == 0:
        return 0.0
    return btc_held / market_cap

def btc_per_dollar_cebe(cebe: float, price: float) -> float:
    """BTC per $1 (CEBE) = cebe / price"""
    if price == 0:
        return 0.0
    return cebe / price

def btc_yield(cebe_now: float, cebe_prev: float) -> Optional[float]:
    """BTC yield = (cebe_now - cebe_prev) / cebe_prev"""
    if cebe_prev == 0 or cebe_prev is None:
        return None
    return (cebe_now - cebe_prev) / cebe_prev

def compute_cebe_snapshot(s: CapitalSnapshot) -> CEBEResult:
    senior = senior_claims_usd(s.otm_converts_notional, s.pref_notional, s.usd_reserve)
    net = net_btc_coins(s.btc_held, senior, s.p_btc)
    cebe = cebe_per_share(net, s.adso)
    mg = mnav_gross(s.market_cap, s.btc_held, s.p_btc)
    # EV: market_cap + debt + pref_notional - cash (use usd_reserve as cash if cash not separately set)
    cash = s.cash if s.cash != 0 else s.usd_reserve
    mev = mnav_ev(s.market_cap, s.debt_notional, s.pref_notional, cash, s.btc_held, s.p_btc)
    mc = mnav_cebe(s.price, cebe, s.p_btc)
    bpg = btc_per_dollar_gross(s.btc_held, s.market_cap)
    bpc = btc_per_dollar_cebe(cebe, s.price)
    return CEBEResult(
        senior_claims_usd=senior,
        net_btc=net,
        cebe_btc_per_share=cebe,
        mnav_gross=mg,
        mnav_ev=mev,
        mnav_cebe=mc,
        btc_per_dollar_gross=bpg,
        btc_per_dollar_cebe=bpc,
        btc_per_million_gross=bpg * 1_000_000,
        btc_per_million_cebe=bpc * 1_000_000,
    )

# --- Preferred metrics ---

@dataclass
class PreferredSnapshot:
    ticker: str
    price: float
    par: float = 100.0
    coupon_annual: float = 0.0  # e.g. 0.10 for 10%
    cumulative: bool = True
    issuer_coverage_months: Optional[float] = None
    seniority_rank: int = 1

def preferred_price_to_par(price: float, par: float) -> float:
    return price / par if par else 0.0

def preferred_distance_to_par(price: float, par: float) -> float:
    return (par - price) / par if par else 0.0

def preferred_effective_yield(coupon_annual: float, price: float, par: float) -> float:
    """Simple effective yield = annual dividend / price, where dividend = coupon * par"""
    if price == 0:
        return 0.0
    return (coupon_annual * par) / price

def preferred_stripped_yield(coupon_annual: float, price: float, par: float, accrued: float = 0.0) -> float:
    """Stripped yield ex-accrued; if no accrued passed, equals effective yield."""
    clean = price - accrued
    if clean <= 0:
        return 0.0
    return (coupon_annual * par) / clean

# --- Credit stress ---

def btc_breakeven_price(senior_claims_usd_val: float, btc_held: float) -> Optional[float]:
    """
    BTC price at which net reserve hits 0:
      net_btc = 0 => btc_held = senior / p_btc => p_btc = senior / btc_held
    If btc_held==0 or senior<=0, no breakeven (already solvent or no coins).
    """
    if btc_held <= 0:
        return None
    if senior_claims_usd_val <= 0:
        return 0.0  # already covered even at $0 BTC
    return senior_claims_usd_val / btc_held

def dividend_coverage_months(usd_reserve: float, monthly_dividend_burn: float) -> Optional[float]:
    if monthly_dividend_burn <= 0:
        return None
    if usd_reserve <= 0:
        return 0.0
    return usd_reserve / monthly_dividend_burn

# --- Look-through accounting (Layer A) ---

def look_through_btc_equivalent(usd_market_value: float, p_btc: float) -> float:
    """Mark-to-market BTC-equivalent = usd_mv / p_btc"""
    if p_btc == 0:
        return 0.0
    return usd_market_value / p_btc

def look_through_cebe_btc(shares: float, cebe: float) -> float:
    """Economic look-through BTC (commons) = shares * CEBE"""
    return shares * cebe

# --- Horizon helpers (Layer B stubs) ---

def mean_reversion_alpha(mnav_now: float, mnav_fair: float, kappa: float = 0.15) -> float:
    """
    α_mnav = κ * (mNAV_fair - mNAV_now) / mNAV_now
    kappa small; calibrated so half-life is months not days.
    """
    if mnav_now == 0:
        return 0.0
    return kappa * (mnav_fair - mnav_now) / mnav_now

def btc_relative_return(usd_total_return: float, p_btc_now: float, p_btc_h: float) -> float:
    """
    r_btc ≈ (1 + usd_total_return) * (P_now / E[P_H]) - 1
    High USD coupon can still lose BTC if BTC rips.
    """
    if p_btc_h == 0:
        return 0.0
    return (1 + usd_total_return) * (p_btc_now / p_btc_h) - 1
