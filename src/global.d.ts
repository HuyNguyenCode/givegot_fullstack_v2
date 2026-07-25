// Ambient module declaration for plain (non-`.module.css`) CSS side-effect imports,
// e.g. `import './globals.css'`. Next.js's bundled TS plugin only ships types for
// `*.module.css`, so editors/tsservers that enforce side-effect import checks can
// flag plain CSS imports even though the Next.js build handles them natively.
declare module '*.css'
