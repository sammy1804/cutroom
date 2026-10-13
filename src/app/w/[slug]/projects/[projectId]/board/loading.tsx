export default function BoardLoading() {
  return (
    <div className="flex h-dvh flex-col bg-background" aria-busy="true" aria-label="Loading board">
      <div className="h-12 border-b" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[300px] border-r bg-sidebar lg:block" />
        <div className="flex-1" style={{ backgroundImage: "radial-gradient(circle, var(--border) 1.2px, transparent 1.2px)", backgroundSize: "24px 24px" }} />
        <div className="hidden w-[320px] border-l bg-sidebar lg:block" />
      </div>
      <div className="h-[210px] border-t bg-sidebar" />
    </div>
  );
}
