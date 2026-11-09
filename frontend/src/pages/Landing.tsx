import { Link } from 'react-router'
import { outlineButton, Price, primaryButton } from '../ui.tsx'

function Landing() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6">
      {/* A real-looking shelf tag: the app remembers what you last paid */}
      <p aria-hidden className="flex items-baseline gap-3 text-ink/70">
        Oat milk <Price cents={189} size="lg" />
      </p>
      <h1 className="font-tag text-5xl leading-none font-bold sm:text-7xl">Don't sweat it, shopwith ease.</h1>
      <p className="max-w-prose text-lg text-ink/70">
        Shopping lists that remember what you paid, so you know what this week's shop will cost before you go.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/auth?mode=register" className={primaryButton}>
          Create account
        </Link>
        <Link to="/auth" className={outlineButton}>
          Log in
        </Link>
      </div>
    </section>
  )
}

export default Landing
