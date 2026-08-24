/** Declare CSS Modules and global CSS for TypeScript. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.css'
