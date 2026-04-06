export default function BuyMeACoffee() {
  return (
    <a
      href="https://buymeacoffee.com/ufazien"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-sm text-xs sm:text-sm whitespace-nowrap"
      style={{
        backgroundColor: "#5F7FFF",
        color: "#ffffff",
        fontFamily: "Lato, sans-serif",
        border: "2px solid #000000",
        textDecoration: "none",
        fontWeight: 500,
        minWidth: "fit-content",
      }}
    >
      <span className="text-base sm:text-lg" style={{ lineHeight: 1 }}>☕</span>
      <span className="hidden sm:inline">Buy me a coffee</span>
    </a>
  )
}
