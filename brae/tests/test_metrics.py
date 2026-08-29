import math
import sys
sys.path.insert(0, "Projects/btc-rotator-v2")
from brae.metrics import *

def test_mnav_gross():
    # Hand-fixture: MSTR holds 100 BTC @ 100k => BTC value = 10M. Market cap 15M => mNAV gross 1.5
    assert abs(mnav_gross(15_000_000, 100, 100_000) - 1.5) < 1e-9
    assert mnav_gross(0, 100, 100_000) == 0.0
    assert mnav_gross(10_000_000, 0, 100_000) == math.inf

def test_senior_and_net_btc():
    # Strategy-like: btc 100, p=100k, pref 2M, converts OTM 1M, reserve 0.5M => senior = 2.5M, net = 100 - 25 = 75
    senior = senior_claims_usd(1_000_000, 2_000_000, 500_000)
    assert senior == 2_500_000
    net = net_btc_coins(100, senior, 100_000)
    assert abs(net - 75) < 1e-9
    cebe = cebe_per_share(net, 10)
    assert abs(cebe - 7.5) < 1e-9
    m = mnav_cebe(750_000, cebe, 100_000)  # price 750k per share? unrealistic but formula: 750k / (7.5*100k)=1.0
    assert abs(m - 1.0) < 1e-9

def test_synthetic_8k_reduces_cebe():
    """Acceptance: synthetic 8-K that adds pref notional with unchanged BTC reduces CEBE and raises mNAV_cebe"""
    p = 100_000
    before = CapitalSnapshot(ticker="MSTR", btc_held=100, p_btc=p, price=300, market_cap=3_000_000, basic_shares=10_000, adso=12_000, usd_reserve=1_000_000, pref_notional=2_000_000, otm_converts_notional=0)
    after = CapitalSnapshot(ticker="MSTR", btc_held=100, p_btc=p, price=300, market_cap=3_000_000, basic_shares=10_000, adso=12_000, usd_reserve=1_000_000, pref_notional=5_000_000, otm_converts_notional=0)
    r_before = compute_cebe_snapshot(before)
    r_after = compute_cebe_snapshot(after)
    assert r_after.cebe_btc_per_share < r_before.cebe_btc_per_share, "CEBE must fall when pref notional added"
    assert r_after.mnav_cebe > r_before.mnav_cebe, "mNAV_cebe must rise"
    print(f"PASS 8K: CEBE {r_before.cebe_btc_per_share:.6f} -> {r_after.cebe_btc_per_share:.6f}, mNAV_cebe {r_before.mnav_cebe:.4f} -> {r_after.mnav_cebe:.4f}")

def test_btc_per_dollar():
    assert abs(btc_per_dollar_gross(100, 10_000_000) - 0.00001) < 1e-10
    cebe = 0.0075
    price = 300
    assert abs(btc_per_dollar_cebe(cebe, price) - 0.000025) < 1e-10

def test_btc_one_percent_move():
    """Changing BTC +1% with equity unchanged updates W_btc correctly."""
    usd_mv = 1_000_000
    p0 = 100_000
    p1 = 101_000
    w0 = look_through_btc_equivalent(usd_mv, p0)
    w1 = look_through_btc_equivalent(usd_mv, p1)
    assert abs(w0 - 10.0) < 1e-9
    assert abs(w1 - 9.900990099) < 1e-9
    # W_btc falls when BTC price rises if equity price unchanged
    assert w1 < w0

def test_preferred_yields():
    assert abs(preferred_effective_yield(0.10, 100, 100) - 0.10) < 1e-9
    assert abs(preferred_effective_yield(0.10, 80, 100) - 0.125) < 1e-9
    assert abs(preferred_price_to_par(95, 100) - 0.95) < 1e-9
    assert abs(preferred_distance_to_par(95, 100) - 0.05) < 1e-9

def test_breakeven():
    assert btc_breakeven_price(10_000_000, 100) == 100_000
    assert btc_breakeven_price(-1_000, 100) == 0.0
    assert btc_breakeven_price(1_000, 0) is None

def test_compute_full_snapshot_strategy_claims():
    # Cross-check all identities on a single snapshot
    s = CapitalSnapshot(ticker="MSTR", btc_held=500_000, p_btc=115_000, price=350, market_cap=35_000_000_000, basic_shares=100_000_000, adso=120_000_000, usd_reserve=2_000_000_000, debt_notional=1_000_000_000, pref_notional=4_000_000_000, otm_converts_notional=2_000_000_000, holdings_as_of="2026-07-24", price_as_of="2026-08-29")
    r = compute_cebe_snapshot(s)
    # senior = 2+4-2 =4B
    assert abs(r.senior_claims_usd - 4_000_000_000) < 1
    # net = 500k - 4B/115k ≈ 500k - 34782.6 = 465217.39
    assert abs(r.net_btc - 465217.3913) < 1
    # cebe = net / 120M ≈ 0.0038768
    assert abs(r.cebe_btc_per_share - 0.0038768) < 1e-6
    # mNAV_cebe = 350 / (0.0038768*115000) ≈ 0.785
    assert r.mnav_cebe < 1.0 and r.mnav_cebe > 0.5
    print(f"Strategy snapshot: mNAV_gross={r.mnav_gross:.3f} mNAV_cebe={r.mnav_cebe:.3f} CEBE={r.cebe_btc_per_share:.6f} BTC/$1m CEBE={r.btc_per_million_cebe:.4f}")

if __name__ == "__main__":
    test_mnav_gross()
    test_senior_and_net_btc()
    test_synthetic_8k_reduces_cebe()
    test_btc_per_dollar()
    test_btc_one_percent_move()
    test_preferred_yields()
    test_breakeven()
    test_compute_full_snapshot_strategy_claims()
    print("All brae.metrics tests passed")
