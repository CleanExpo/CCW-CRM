"""Search utility helpers."""


def sanitize_like_term(term: str) -> str:
    """
    Escape LIKE special characters from user-supplied search terms.

    SQLAlchemy parameterises the query so SQL injection is not a risk, but
    unescaped % and _ in user input would be interpreted as LIKE wildcards,
    potentially causing wildcard-proliferation performance issues.

    Usage:
        from src.utils.search import sanitize_like_term
        query = query.where(Model.column.ilike(f"%{sanitize_like_term(search)}%"))
    """
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
