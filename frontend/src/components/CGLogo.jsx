// Animated "code-grammerizer" wordmark. Collapsed to `<c-g/>` at rest; the
// hidden segments expand on hover / keyboard focus. All styles are scoped to
// `.cg-logo` — including the Bungee Inline font, which is used nowhere else.
const css = `
.cg-logo {
  --c-red:#F94144; --c-pink:#FF5D8F; --c-blue:#2D5BFF; --c-peach:#FFB4A2;
  --c-teal:#00A896; --c-yellow:#FFD60A; --c-purple:#7B5CFF;
  font-family: 'Bungee Inline', system-ui, sans-serif;
  display: inline-flex;
  align-items: baseline;
  cursor: pointer;
  text-decoration: none;
  font-weight: 400;
  font-size: 22px;
  letter-spacing: 1px;
  text-transform: uppercase;
  line-height: 1;
  user-select: none;
}
.cg-logo .ch { display: inline-block; }
.cg-logo .sym { color: #0F7B1F; }
.cg-logo .k1 { color: var(--c-red); }
.cg-logo .k2 { color: var(--c-pink); }
.cg-logo .k3 { color: var(--c-blue); }
.cg-logo .k4 { color: var(--c-peach); }
.cg-logo .k5 { color: var(--c-teal); }
.cg-logo .k6 { color: var(--c-yellow); }
.cg-logo .k7 { color: var(--c-purple); }
.cg-logo .word { display: inline-flex; align-items: baseline; }
.cg-logo .expand {
  display: inline-flex;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  transform: translateY(2px);
  transition:
    max-width 0.55s cubic-bezier(0.65, 0, 0.35, 1),
    opacity 0.35s ease 0.08s,
    transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.cg-logo:hover .expand,
.cg-logo:focus-visible .expand {
  max-width: 340px;
  opacity: 1;
  transform: translateY(0);
}
.cg-logo .anchor { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.cg-logo:hover .anchor { transform: scale(1.08); }
@media (prefers-reduced-motion: reduce) {
  .cg-logo .expand, .cg-logo .anchor { transition: none; }
}
`

export default function CGLogo({ className = '' }) {
  return (
    <>
      <style>{css}</style>
      <span className={`cg-logo ${className}`} aria-label="code-grammerizer home" tabIndex={0}>
        <span className="ch sym">&lt;</span>
        <span className="word">
          <span className="ch k1 anchor">c</span>
          <span className="expand">
            <span className="ch k2">o</span>
            <span className="ch k3">d</span>
            <span className="ch k4">e</span>
            <span className="ch sym">-</span>
          </span>
          <span className="ch k5 anchor">g</span>
          <span className="expand">
            <span className="ch k6">r</span>
            <span className="ch k7">a</span>
            <span className="ch k1">m</span>
            <span className="ch k2">m</span>
            <span className="ch k3">e</span>
            <span className="ch k4">r</span>
            <span className="ch k5">i</span>
            <span className="ch k6">z</span>
            <span className="ch k7">e</span>
            <span className="ch k1">r</span>
          </span>
        </span>
        <span className="ch sym">/&gt;</span>
      </span>
    </>
  )
}
