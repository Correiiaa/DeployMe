import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'

import type { ApplicationRow } from './ApplicationTable'

type InterviewDossierProps = {
  application: ApplicationRow | null
  onClose: () => void
}

export default function InterviewDossier({ application, onClose }: InterviewDossierProps) {
  const [quickNotes, setQuickNotes] = useState('')
  const [questionInput, setQuestionInput] = useState('')
  const [questions, setQuestions] = useState<string[]>([])

  useEffect(() => {
    setQuickNotes('')
    setQuestionInput('')
    setQuestions([])
  }, [application?.id])

  if (!application) return null

  function addQuestion() {
    const nextQuestion = questionInput.trim()
    if (!nextQuestion) return

    setQuestions((currentQuestions) => [...currentQuestions, nextQuestion])
    setQuestionInput('')
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Fechar dossier"
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l border-gray-200">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Dossier de Entrevista
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">{application.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {application.role} · {application.status}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-slate-50/70">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Vaga
                  </h3>
                  <p className="mt-2 text-base font-medium text-gray-900">{application.name}</p>
                  <p className="text-sm text-gray-500">
                    Candidatura enviada em {application.dateApplied}
                  </p>
                </div>

                <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                  CV ligado
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
                Notas Rápidas
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Escreve aqui os apontamentos que não queres perder antes da entrevista.
              </p>
              <textarea
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder="O recrutador chama-se João..."
                className="mt-4 min-h-36 w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
              />
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
                Perguntas para a Empresa
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Prepara as tuas perguntas antes da chamada para não improvisares no momento.
              </p>

              <div className="mt-4 flex gap-3">
                <input
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addQuestion()
                    }
                  }}
                  placeholder="Ex.: Como é a equipa técnica?"
                  className="h-11 flex-1 rounded-xl border border-gray-200 bg-slate-50 px-4 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={addQuestion}
                  className="h-11 rounded-xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-stone-900"
                >
                  Adicionar
                </button>
              </div>

              <ul className="mt-4 space-y-3">
                {questions.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-400">
                    Ainda não há perguntas guardadas.
                  </li>
                ) : (
                  questions.map((question, index) => (
                    <li
                      key={`${question}-${index}`}
                      className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-700"
                    >
                      {question}
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>
      </aside>
    </div>
  )
}
