type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Container({
  children,
  className = "",
}: ContainerProps) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6 lg:px-8">
      <div className={className}>{children}</div>
    </div>
  );
}