export function BankIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[650px]" aria-hidden="true">
      <svg
        className="h-auto w-full"
        viewBox="0 0 720 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="heroSky" x1="96" y1="52" x2="581" y2="465" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F5FAFF" />
            <stop offset="1" stopColor="#DCEBFA" />
          </linearGradient>
          <linearGradient id="screen" x1="230" y1="293" x2="458" y2="417" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0B63E5" />
            <stop offset="1" stopColor="#073F94" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#12335A" floodOpacity="0.12" />
          </filter>
        </defs>

        <path d="M77 379C29 280 79 145 189 92C294 40 435 51 535 127C633 202 680 339 611 419C539 502 131 490 77 379Z" fill="url(#heroSky)" />
        <circle cx="570" cy="110" r="35" fill="#D1E5FA" />
        <circle cx="112" cy="166" r="17" fill="#DCEBFA" />

        <g opacity="0.6">
          <path d="M44 353V226H95V353" fill="#DCE8F5" />
          <path d="M58 244H70M58 265H70M58 286H70M78 244H88M78 265H88M78 286H88" stroke="#F7FAFD" strokeWidth="6" />
          <path d="M607 351V184H667V351" fill="#D8E7F5" />
          <path d="M621 207H652M621 229H652M621 251H652M621 273H652" stroke="#F7FAFD" strokeWidth="7" />
          <path d="M535 351V245H585V351" fill="#E3EDF7" />
        </g>

        <g filter="url(#softShadow)">
          <path d="M203 169L341 89L479 169H203Z" fill="#0B1F3A" />
          <path d="M219 173H463V194H219V173Z" fill="#0B63E5" />
          <path d="M232 204H275V319H232V204ZM319 204H362V319H319V204ZM406 204H449V319H406V204Z" fill="white" />
          <path d="M224 198H283V214H224V198ZM311 198H370V214H311V198ZM398 198H457V214H398V198Z" fill="#CADDF1" />
          <path d="M224 311H283V327H224V311ZM311 311H370V327H311V311ZM398 311H457V327H398V311Z" fill="#B9D2EB" />
          <path d="M204 327H478V348H204V327Z" fill="#0B1F3A" />
          <path d="M190 347H492V365H190V347Z" fill="#0B63E5" />
          <circle cx="341" cy="151" r="36" fill="white" />
          <text x="341" y="165" textAnchor="middle" fill="#0B63E5" fontFamily="Georgia, serif" fontSize="54" fontWeight="700">π</text>
        </g>

        <g filter="url(#softShadow)">
          <rect x="193" y="287" width="278" height="166" rx="12" fill="#0B1F3A" />
          <rect x="207" y="301" width="250" height="138" rx="5" fill="url(#screen)" />
          <rect x="232" y="321" width="74" height="11" rx="5.5" fill="white" fillOpacity="0.9" />
          <rect x="232" y="341" width="43" height="7" rx="3.5" fill="#A8D0FF" />
          <rect x="232" y="377" width="45" height="39" rx="5" fill="white" fillOpacity="0.16" />
          <rect x="288" y="362" width="45" height="54" rx="5" fill="white" fillOpacity="0.2" />
          <rect x="344" y="345" width="45" height="71" rx="5" fill="white" fillOpacity="0.28" />
          <path d="M409 394L422 378L433 385L447 356" stroke="#72D5B4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M167 453H497L476 474H188L167 453Z" fill="#C5D9ED" />
          <path d="M297 453H367L359 462H305L297 453Z" fill="#8CAECB" />
        </g>

        <g filter="url(#softShadow)">
          <rect x="484" y="267" width="105" height="188" rx="20" fill="#061A33" />
          <rect x="494" y="283" width="85" height="151" rx="10" fill="white" />
          <rect x="520" y="273" width="32" height="5" rx="2.5" fill="#7391AE" />
          <circle cx="536" cy="332" r="22" fill="#EAF2FB" />
          <text x="536" y="343" textAnchor="middle" fill="#0B63E5" fontFamily="Arial" fontSize="31" fontWeight="700">₹</text>
          <rect x="507" y="371" width="58" height="8" rx="4" fill="#D7E4F1" />
          <rect x="516" y="389" width="40" height="7" rx="3.5" fill="#D7E4F1" />
          <circle cx="536" cy="445" r="5" fill="#89A3BC" />
        </g>

        <g filter="url(#softShadow)">
          <path d="M160 261L160 214L199 198L238 214V261C238 304 199 324 199 324C199 324 160 304 160 261Z" fill="#0B63E5" />
          <path d="M183 256V240C183 231 190 224 199 224C208 224 215 231 215 240V256" stroke="white" strokeWidth="7" strokeLinecap="round" />
          <rect x="177" y="251" width="44" height="37" rx="8" fill="white" />
          <circle cx="199" cy="268" r="5" fill="#0B63E5" />
          <path d="M199 271V278" stroke="#0B63E5" strokeWidth="4" strokeLinecap="round" />
        </g>

        <g filter="url(#softShadow)">
          <circle cx="589" cy="212" r="48" fill="white" />
          <text x="589" y="229" textAnchor="middle" fill="#0B63E5" fontFamily="Arial" fontSize="54" fontWeight="700">₹</text>
        </g>

        <path d="M115 472H632" stroke="#C7DBEE" strokeWidth="4" strokeLinecap="round" />
        <path d="M91 198C91 182 104 169 120 169H140" stroke="#AFCDE9" strokeWidth="4" strokeLinecap="round" />
        <path d="M620 144H645C658 144 668 154 668 167" stroke="#AFCDE9" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
