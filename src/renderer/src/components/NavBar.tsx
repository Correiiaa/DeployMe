import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faRocket, faGear, faMoon } from '@fortawesome/free-solid-svg-icons'

export default function NavBar() {
  return (
    <header className="relative z-20 h-16 w-full border-b border-white/10 bg-slate-200 text-black flex flex-row">
      <div className="max-w-5xl w-full mx-auto px-6 flex items-center justify-between h-16">
        <FontAwesomeIcon icon={faRocket} className="text-red-500" />
        <div className="text-xl font-bold cursor-pointer flex flex-row items-center gap-4">
          Deploy
        </div>
        <span className="text-slate-600 mr-auto font-bold">Me</span>
        <nav className="items-center gap-6 flex flex-row ">
          <div className="rounded-2xl bg-stone-300 min-w-25 h-11 hover:bg-stone-400 cursor-pointer flex items-center justify-center">
            <FontAwesomeIcon icon={faUser} className="pr-3" />
            <div className="text-black self-center text-base text-center">User</div>
          </div>
          <FontAwesomeIcon
            icon={faGear}
            className=" hover:cursor-pointer hover:text-stone-600 ml-auto w-5"
          />
          <FontAwesomeIcon
            icon={faMoon}
            className="hover:cursor-pointer hover:text-stone-600 mr-auto w-5"
          />
        </nav>
      </div>
    </header>
  )
}
