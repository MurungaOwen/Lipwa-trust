def calculate_trust_score(avg_daily_sales: float, consistency: float, days_active: int) -> dict:
    """
    Calculates a rule-based trust score and credit limit.
    For MVP, this is a simplified calculation.
    """
    # Example rule-based scoring (can be refined later)
    score = 0
    credit_limit = 0.0

    # Sales consistency adds to score
    if consistency > 0.8:
        score += 30
    elif consistency > 0.5:
        score += 15

    # Average daily sales contributes to score and credit limit
    if avg_daily_sales > 1000:  # KES
        score += 40
        credit_limit += avg_daily_sales * 5
    elif avg_daily_sales > 500:
        score += 20
        credit_limit += avg_daily_sales * 2

    # Days active adds to score
    if days_active > 90:
        score += 30
    elif days_active > 30:
        score += 15

    # Ensure score is within 0-100
    score = max(0, min(100, score))
    # Credit limit should be a reasonable value
    credit_limit = max(0.0, credit_limit)

    return {"score": score, "credit_limit": credit_limit}
