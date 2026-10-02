import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import * as Slot from "radix-ui/slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-wait aria-busy:opacity-70 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        outline: "border border-border bg-background hover:bg-muted active:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80",
        ghost: "hover:bg-muted active:bg-muted",
        destructive: "bg-destructive text-primary-foreground hover:bg-destructive/90 active:bg-destructive/80",
        link: "text-primary underline-offset-4 hover:underline active:underline",
      },
      size: {
        default: "h-touch",
        xs: "h-touch px-2 text-xs",
        sm: "h-touch px-2",
        lg: "h-12 px-4",
        icon: "size-touch p-0",
        "icon-xs": "size-touch p-0",
        "icon-sm": "size-touch p-0",
        "icon-lg": "size-12 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({ className, variant, size, asChild = false, ...props }:
  ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
