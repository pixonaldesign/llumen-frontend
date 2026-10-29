const SOURCE_SQL_TOKEN_PATTERN =
  /(\$[A-Za-z_][A-Za-z0-9_]*|'(?:''|[^'])*'|\b(?:SELECT|FROM|JOIN|LEFT|RIGHT|INNER|OUTER|ON|WHERE|AND|OR|BETWEEN|ORDER|BY|AS|LIMIT|GROUP|HAVING|DESC|ASC)\b|\b\d+(?:\.\d+)?\b)/gi;

const SOURCE_SQL_KEYWORD_PATTERN =
  /^(?:SELECT|FROM|JOIN|LEFT|RIGHT|INNER|OUTER|ON|WHERE|AND|OR|BETWEEN|ORDER|BY|AS|LIMIT|GROUP|HAVING|DESC|ASC)$/i;

export default function HighlightedSourceSql({ value }: { value: string }) {
  return (
    <>
      {(value || " ").split(SOURCE_SQL_TOKEN_PATTERN).map((token, index) => {
        const className = token.startsWith("$")
          ? "is-variable"
          : token.startsWith("'")
            ? "is-string"
            : SOURCE_SQL_KEYWORD_PATTERN.test(token)
              ? "is-keyword"
              : /^\d/.test(token)
                ? "is-number"
                : undefined;
        return (
          <span className={className} key={`${index}-${token}`}>
            {token}
          </span>
        );
      })}
    </>
  );
}
