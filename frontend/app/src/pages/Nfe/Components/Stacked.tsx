

export default function Stacked() {
  return (
    <>
      <div className="min-h-full">
        <div className="sm:bg-slate-600 bg-black pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            </div>
          </header>
        </div>

        <main className="-mt-32">
          <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
            <input type="text" id="searchParams" className="rounded-lg bg-white px-3 py-2 w-full shadow sm:px-4"></input>
          </div>
        </main>
      </div>
    </>
  )
}
