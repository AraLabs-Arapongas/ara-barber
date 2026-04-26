import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'AraLabs — Agenda online e operação pro seu negócio'

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#17343F',
        fontFamily: 'sans-serif',
        color: '#fbf6ea',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 220,
          height: 220,
          background: '#fbf6ea',
          borderRadius: 32,
          marginBottom: 48,
        }}
      >
        <svg width="140" height="130" viewBox="0 0 184 170">
          <g transform="translate(0,170) scale(0.1,-0.1)" fill="#17343F">
            <path d="M887 1509 c-20 -35 -72 -131 -116 -214 l-80 -149 71 -136 c39 -74 88 -166 110 -203 21 -38 38 -70 38 -72 0 -2 -30 -8 -67 -15 -292 -50 -549 -244 -687 -518 -15 -30 -26 -55 -24 -57 2 -1 115 0 252 3 l248 5 35 76 c19 42 82 171 140 288 78 157 111 213 127 217 11 3 69 11 127 17 88 9 124 8 214 -5 60 -9 109 -15 110 -13 6 7 -428 802 -450 826 -11 11 -19 2 -48 -50z" />
            <path d="M1276 658 c-92 -48 -216 -146 -216 -170 0 -6 33 -84 73 -174 l72 -164 243 0 c133 0 242 1 242 3 0 15 -292 553 -302 554 -7 2 -57 -21 -112 -49z" />
          </g>
        </svg>
      </div>
      <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -1 }}>AraLabs</div>
      <div style={{ fontSize: 36, color: '#b9945a', marginTop: 16 }}>
        Agenda online pro seu negócio
      </div>
    </div>,
    { ...size },
  )
}
