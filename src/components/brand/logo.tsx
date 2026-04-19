import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Lockup da marca AraLabs: mark + wordmark lado a lado.
 * Renderizado em `currentColor` — tinja via `text-*` na classe.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-2.5 text-fg', className)}
      aria-label="AraLabs"
    >
      <AraLabsMark className="h-7 w-auto" />
      <AraLabsWordmark className="h-4 w-auto" />
    </span>
  )
}

/**
 * Monograma AraLabs — só o mark em quadrado arredondado sobre --brand-primary.
 * Mantém a API antiga (usado em Platform login + home). Cor configurável via
 * `style.color` ou `text-*` classe (mark herda currentColor).
 */
export function Monogram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-10 w-10', className)}
      role="img"
      aria-label="AraLabs"
      {...props}
    >
      <rect width="64" height="64" rx="16" fill="var(--brand-primary)" />
      <g transform="translate(16 15) scale(0.175)">
        <AraLabsMarkPath fill="var(--brand-primary-fg)" />
      </g>
    </svg>
  )
}

/**
 * Mark da AraLabs sem moldura — forma abstrata em `currentColor`.
 * Use em: headers, footers, lockups compostos.
 */
export function AraLabsMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 184 170" className={cn(className)} role="img" aria-label="AraLabs" {...props}>
      <AraLabsMarkPath fill="currentColor" />
    </svg>
  )
}

/**
 * Wordmark "aralabs" isolado (sem mark). Útil em footers longos, splash, etc.
 */
export function AraLabsWordmark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1978 534"
      className={cn(className)}
      role="img"
      aria-label="AraLabs"
      {...props}
    >
      <g transform="translate(0,534) scale(0.1,-0.1)" fill="currentColor" stroke="none">
        <path d="M9908 4920 c-225 -13 -321 -52 -371 -151 l-28 -55 -1 -2130 c-1 -1171 2 -2135 6 -2142 5 -9 88 -12 327 -12 l319 0 0 1453 c0 800 3 1812 7 2250 l6 797 -64 -2 c-35 0 -126 -4 -201 -8z" />
        <path d="M14255 4919 c-229 -17 -333 -65 -382 -174 -17 -38 -18 -143 -21 -2177 l-3 -2138 326 0 325 0 0 160 c0 88 2 160 5 160 2 0 42 -30 87 -67 185 -149 343 -231 543 -283 279 -71 532 -65 795 21 211 69 354 161 530 339 269 273 424 635 448 1043 27 462 -86 878 -330 1209 -120 164 -315 331 -486 417 -93 47 -253 97 -370 116 -142 24 -419 17 -547 -13 -206 -48 -362 -121 -496 -232 -46 -38 -100 -83 -120 -100 l-37 -30 -7 283 c-3 155 -5 551 -3 880 l3 597 -80 -1 c-44 -1 -125 -5 -180 -10z m1335 -1988 c47 -12 128 -43 180 -68 79 -39 110 -62 186 -138 130 -129 202 -261 253 -463 66 -259 37 -613 -68 -838 -109 -233 -268 -376 -497 -447 -106 -34 -142 -39 -255 -38 -436 3 -749 227 -869 624 -87 289 -58 680 70 942 116 237 298 379 565 441 88 20 324 12 435 -15z" />
        <path d="M2103 4890 c-98 -24 -199 -65 -248 -98 -88 -61 -180 -209 -268 -432 -25 -63 -112 -290 -192 -505 -106 -280 -1271 -3289 -1322 -3412 -4 -10 69 -13 348 -13 l354 0 109 283 c60 155 133 345 163 422 30 77 64 165 76 197 l22 56 380 4 c209 1 637 2 951 0 l570 -4 117 -316 c64 -174 142 -389 172 -477 l54 -160 346 -3 c190 -1 345 -1 345 1 0 2 -122 331 -271 733 -148 401 -360 972 -470 1269 -111 297 -322 871 -470 1275 -148 404 -299 816 -336 915 -36 99 -76 204 -89 233 l-23 52 -123 -1 c-82 -1 -147 -7 -195 -19z m55 -1020 c22 -63 69 -203 105 -310 35 -107 98 -289 140 -405 42 -115 112 -313 156 -440 127 -367 207 -584 276 -757 7 -17 -32 -18 -734 -18 -493 0 -741 3 -741 10 0 21 138 425 272 795 63 174 343 932 357 966 5 13 31 80 56 149 26 69 49 129 52 133 9 15 20 -6 61 -123z" />
        <path d="M5860 3600 c-288 -51 -442 -133 -648 -344 -81 -83 -113 -109 -116 -97 -7 26 -34 169 -46 251 -6 41 -14 83 -16 93 -5 15 -24 17 -223 17 -215 0 -297 -8 -349 -32 -22 -11 -30 -26 -44 -78 -15 -59 -17 -191 -17 -1522 l-1 -1458 331 0 331 0 -3 912 -3 913 23 95 c89 371 358 556 839 579 l137 6 27 115 c37 155 126 520 134 548 l6 22 -128 -1 c-77 0 -172 -8 -234 -19z" />
        <path d="M7410 3544 c-526 -82 -794 -302 -968 -795 l-31 -86 97 -37 c279 -106 445 -167 447 -164 2 2 15 35 30 73 113 301 364 464 683 442 270 -19 443 -141 506 -357 13 -45 38 -231 33 -237 -1 0 -114 -13 -252 -28 -672 -71 -1024 -154 -1273 -300 -146 -85 -244 -216 -306 -411 -35 -108 -48 -199 -48 -329 0 -279 74 -479 246 -662 117 -126 281 -217 489 -271 95 -25 116 -27 317 -27 190 1 226 3 305 23 196 50 346 132 510 280 49 45 91 80 93 78 3 -4 61 -283 62 -298 0 -11 620 -10 620 1 0 5 -9 56 -20 112 -46 241 -52 353 -60 1204 -8 879 -10 910 -66 1067 -104 288 -290 498 -549 619 -99 47 -145 62 -275 91 -125 28 -447 35 -590 12z m808 -1639 c1 -1 3 -107 5 -236 1 -200 -1 -244 -17 -304 -62 -239 -210 -385 -461 -457 -66 -18 -105 -23 -220 -23 -125 0 -149 3 -225 27 -207 67 -293 200 -294 453 -1 104 2 127 22 170 36 79 69 120 130 163 111 77 247 117 527 157 385 55 512 66 533 50z" />
        <path d="M11756 3540 c-554 -94 -887 -372 -980 -820 -12 -56 -12 -67 1 -76 16 -13 269 -111 413 -160 l95 -32 26 73 c44 120 89 196 159 266 103 103 222 158 391 179 156 20 344 -14 462 -83 53 -31 128 -111 155 -164 30 -58 51 -150 58 -251 l7 -91 -34 -5 c-19 -3 -119 -15 -224 -26 -472 -51 -871 -123 -1057 -190 -221 -80 -399 -240 -492 -442 -63 -134 -80 -222 -79 -403 1 -138 4 -173 26 -257 14 -53 34 -117 45 -141 54 -122 211 -311 316 -381 189 -126 409 -186 676 -186 331 0 603 102 821 307 46 44 70 61 74 52 3 -8 14 -56 25 -107 10 -50 24 -110 30 -132 l11 -40 315 0 c296 0 315 1 310 18 -18 64 -52 371 -66 592 -6 91 -15 453 -20 805 -5 352 -14 674 -19 716 -40 306 -128 498 -309 671 -182 174 -404 281 -658 318 -110 16 -354 11 -478 -10z m798 -1810 c18 -343 -32 -520 -185 -665 -171 -161 -475 -229 -714 -160 -140 41 -217 107 -282 242 -83 172 -58 367 64 503 113 126 209 160 593 209 345 45 387 49 450 47 l65 -1 9 -175z" />
        <path d="M18060 3539 c-255 -54 -426 -143 -575 -301 -158 -167 -235 -372 -235 -625 0 -237 67 -408 220 -562 90 -91 184 -155 322 -221 161 -77 282 -113 588 -175 258 -52 381 -114 434 -217 24 -49 29 -69 29 -136 0 -103 -33 -181 -107 -250 -91 -85 -194 -122 -348 -122 -140 0 -295 37 -393 94 -83 49 -155 157 -186 281 l-12 47 -41 -5 c-23 -4 -131 -16 -241 -27 -110 -11 -220 -23 -244 -26 l-44 -6 6 -86 c25 -337 236 -613 572 -747 177 -70 348 -99 585 -99 458 0 772 144 964 441 98 152 140 302 140 498 -1 279 -108 511 -313 679 -130 106 -247 152 -586 231 -313 72 -502 142 -592 219 -87 76 -115 193 -74 311 50 143 184 227 385 241 152 11 298 -35 398 -125 67 -60 101 -115 134 -215 15 -45 28 -82 29 -84 2 -2 44 4 94 12 149 26 261 44 353 57 48 7 91 15 97 19 15 8 -12 173 -45 274 -48 149 -114 261 -215 363 -139 140 -295 216 -541 264 -140 27 -423 26 -558 -2z" />
      </g>
    </svg>
  )
}

/**
 * Path data do mark AraLabs, extraído pra reuso em Monogram + AraLabsMark.
 */
function AraLabsMarkPath({ fill }: { fill: string }) {
  return (
    <g transform="translate(0,170) scale(0.1,-0.1)" fill={fill} stroke="none">
      <path d="M887 1509 c-20 -35 -72 -131 -116 -214 l-80 -149 71 -136 c39 -74 88 -166 110 -203 21 -38 38 -70 38 -72 0 -2 -30 -8 -67 -15 -292 -50 -549 -244 -687 -518 -15 -30 -26 -55 -24 -57 2 -1 115 0 252 3 l248 5 35 76 c19 42 82 171 140 288 78 157 111 213 127 217 11 3 69 11 127 17 88 9 124 8 214 -5 60 -9 109 -15 110 -13 6 7 -428 802 -450 826 -11 11 -19 2 -48 -50z" />
      <path d="M1276 658 c-92 -48 -216 -146 -216 -170 0 -6 33 -84 73 -174 l72 -164 243 0 c133 0 242 1 242 3 0 15 -292 553 -302 554 -7 2 -57 -21 -112 -49z" />
    </g>
  )
}

/**
 * Ornamento decorativo — listras diagonais warm (referência ao barber pole
 * reinterpretada em paleta quente). Usado como pano de fundo do painel esquerdo
 * do login desktop. Não aparece em mobile.
 */
export function BarberStripeOrnament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      className={cn('absolute inset-0 h-full w-full', className)}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="stripe"
          patternUnits="userSpaceOnUse"
          width="64"
          height="64"
          patternTransform="rotate(22)"
        >
          <rect width="64" height="64" fill="transparent" />
          <rect x="0" y="0" width="20" height="64" fill="var(--brand-accent)" opacity="0.09" />
          <rect x="32" y="0" width="4" height="64" fill="var(--brand-primary)" opacity="0.06" />
        </pattern>
        <radialGradient id="fade" cx="30%" cy="40%" r="70%">
          <stop offset="0%" stopColor="var(--color-bg)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--color-bg)" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#stripe)" />
      <rect width="100%" height="100%" fill="url(#fade)" />
    </svg>
  )
}

/**
 * Glifo ornamental — um "pente tipográfico" feito de linhas finas,
 * referência sutil à barbearia sem representação literal.
 */
export function ComboGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      className={cn('h-40 w-30', className)}
      aria-hidden="true"
      fill="none"
    >
      <g stroke="var(--brand-primary)" strokeWidth="1.25" strokeLinecap="round">
        <path
          d="M10 20 Q60 8 110 20 L110 60 Q60 72 10 60 Z"
          fill="var(--brand-accent)"
          fillOpacity="0.18"
        />
        {Array.from({ length: 14 }).map((_, i) => {
          const x = 14 + i * 7
          return <line key={i} x1={x} y1="60" x2={x} y2={130 - (i % 2) * 8} />
        })}
      </g>
    </svg>
  )
}
