import { useNavigate } from 'react-router-dom'
import { Palette, MessageCircle, ShieldCheck, Users, History, Zap } from 'lucide-react'
import Button from '../components/UI/Button'

const FEATURES = [
  { icon: Zap, title: 'Real-time drawing', copy: 'Every stroke appears on the other screen the instant you make it.' },
  { icon: MessageCircle, title: 'Temporary chat', copy: 'Talk beside the canvas. Nothing you type is ever saved.' },
  { icon: ShieldCheck, title: 'Private rooms', copy: 'Only the two people with the code can ever see the canvas.' },
  { icon: Users, title: 'Two artists only', copy: 'Rooms cap at two people, by design — no crowd, no noise.' },
  { icon: History, title: 'No history', copy: 'No accounts, no galleries, no record of who you drew with.' },
  { icon: Palette, title: 'Instant sync', copy: 'Pick up a pencil and go — the room is ready the moment it opens.' }
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ink-950 text-paper">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:py-16">
        <header className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/20">
            <div className="h-3 w-3 rounded-full bg-signal" />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight">DuoDraw</span>
        </header>

        <main className="flex flex-1 flex-col items-start justify-center py-14">
          <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Draw together.
            <br />
            <span className="text-signal-bright">Leave no trace.</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-paper-dim/75 sm:text-lg">
            A private, temporary canvas where two people can draw and chat together in real time — then it's gone.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" onClick={() => navigate('/create')}>
              Create Private Room
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/join')}>
              Join Room
            </Button>
          </div>

          <div className="mt-6 max-w-md rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3 text-xs text-paper-dim/60">
            Your room is temporary. No permanent profile, collaborator history, or chat history is shown.
          </div>
        </main>

        <section className="grid grid-cols-1 gap-4 border-t border-ink-800 pt-10 sm:grid-cols-2 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl2 border border-ink-800 bg-ink-900/40 p-5">
              <f.icon size={18} className="text-signal-bright" />
              <h3 className="mt-3 font-display text-sm font-semibold text-paper">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-paper-dim/60">{f.copy}</p>
            </div>
          ))}
        </section>

        <footer className="pt-10 text-center text-[11px] text-paper-dim/35">
          Two people. One canvas. Nothing kept afterward.
        </footer>
      </div>
    </div>
  )
}
