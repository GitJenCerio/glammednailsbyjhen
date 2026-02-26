import Image from "next/image";

interface MaintenancePageProps {
  /** Optional message, e.g. "We'll be back by Feb 27, 2025 at 6:00 PM" */
  estimatedReturn?: string;
}

export default function MaintenancePage({ estimatedReturn }: MaintenancePageProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4 sm:px-6">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="Glammed Nails by Jhen"
            width={200}
            height={75}
            className="h-auto w-40 sm:w-52"
            priority
          />
        </div>

        {/* Heading - using brand font via Tailwind theme */}
        <h1
          className="font-heading text-2xl sm:text-3xl md:text-4xl font-semibold text-black mb-4"
          style={{ fontFamily: "var(--font-playfair), serif" }}
        >
          Site Under Maintenance
        </h1>

        <p className="text-subtext text-base sm:text-lg mb-6" style={{ color: "#666666" }}>
          We&apos;re currently making improvements. Please check back soon!
        </p>

        {estimatedReturn && (
          <p
            className="text-sm sm:text-base text-black/80 border border-black/20 rounded-lg py-3 px-4 inline-block"
            style={{ fontFamily: "var(--font-lato), sans-serif" }}
          >
            Estimated return: {estimatedReturn}
          </p>
        )}

        <p className="mt-8 text-sm text-black/60" style={{ fontFamily: "var(--font-lato), sans-serif" }}>
          Thank you for your patience.
        </p>
      </div>
    </main>
  );
}
