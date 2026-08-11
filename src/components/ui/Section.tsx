import { ReactNode } from "react";
import Container from "./Container";

type SectionProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
};

export default function Section({
  children,
  title,
  description,
  className = "",
}: SectionProps) {
  return (
    <section className={`py-10 md:py-14 ${className}`}>
      <Container>
        {(title || description) && (
          <div className="mb-6">
            {title && (
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {title}
              </h2>
            )}

            {description && (
              <p className="mt-2 text-sm text-gray-400">
                {description}
              </p>
            )}
          </div>
        )}

        {children}
      </Container>
    </section>
  );
}