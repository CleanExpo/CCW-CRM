// CSS side-effect imports (globals.css, third-party CSS)
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
