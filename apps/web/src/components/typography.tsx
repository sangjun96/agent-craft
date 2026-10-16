import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const typographyVariants = cva("", {
  variants: {
    variant: {
      h1: "scroll-m-20 font-heading text-4xl font-bold tracking-tight text-balance",
      h2: "scroll-m-20 font-heading text-3xl font-semibold tracking-tight",
      h3: "scroll-m-20 font-heading text-2xl font-semibold tracking-tight",
      h4: "scroll-m-20 font-heading text-xl font-semibold tracking-tight",
      p: "leading-7",
      lead: "text-xl leading-relaxed text-muted-foreground",
      large: "text-lg font-semibold",
      small: "text-sm leading-none font-medium",
      muted: "text-sm text-muted-foreground",
      code: "rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium",
      blockquote: "border-l-2 pl-6 italic",
    },
  },
  defaultVariants: {
    variant: "p",
  },
});

type TypographyVariant = NonNullable<VariantProps<typeof typographyVariants>["variant"]>;

const defaultTagName = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  p: "p",
  lead: "p",
  large: "div",
  small: "small",
  muted: "p",
  code: "code",
  blockquote: "blockquote",
} as const satisfies Record<TypographyVariant, keyof React.JSX.IntrinsicElements>;

/** Single text element for UI copy. Override the tag with `render`, e.g. `<Typography variant="h2" render={<h1 />} />`. */
function Typography({
  className,
  variant = "p",
  render,
  ...props
}: useRender.ComponentProps<"p"> & VariantProps<typeof typographyVariants>) {
  const tag = defaultTagName[variant ?? "p"];
  return useRender({
    defaultTagName: tag,
    props: mergeProps<"p">({ className: cn(typographyVariants({ variant }), className) }, props),
    render,
    state: { slot: "typography", variant },
  });
}

const proseVariants = cva("prose prose-token max-w-none", {
  variants: {
    size: {
      sm: "prose-sm",
      base: "prose-base",
      lg: "prose-lg",
    },
  },
  defaultVariants: {
    size: "base",
  },
});

/** Long-form content (articles, markdown output) styled by @tailwindcss/typography. */
function Prose({
  className,
  size,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof proseVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">({ className: cn(proseVariants({ size }), className) }, props),
    render,
    state: { slot: "prose" },
  });
}

export { Prose, proseVariants, Typography, typographyVariants };
