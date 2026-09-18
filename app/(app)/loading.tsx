// Shown by Next the moment a navigation starts, before the page's data is
// back. One file under (app) covers every route including the module catch
// all, so it is generic: the shape of a page, not any one page.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-6 h-4 w-32 bg-rule" />
      <div className="mb-8 h-8 w-56 bg-rule" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-32 border border-rule rounded-[18px]" />
        <div className="h-32 border border-rule rounded-[18px]" />
        <div className="h-32 border border-rule rounded-[18px]" />
      </div>
    </div>
  )
}
