import { buttonVariants } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import type { TopLink } from "@/config/site-nav"

export interface SectionLink {
  label: string
  href: string
}

export interface SectionLinks {
  title: string
  links: SectionLink[]
}

interface HeaderDrawerProps {
  topLinks?: TopLink[]
  sectionLinks?: SectionLinks[]
}

export default function HeaderDrawer({ topLinks = [], sectionLinks = [] }: HeaderDrawerProps) {
  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger>
        <div className={buttonVariants({ variant: "ghost" })}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="stroke-foreground size-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5"></path></svg>
        </div>
      </DrawerTrigger>
      <DrawerContent className="h-[70vh]">
        <div className="flex-1 p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 items-start">
            <a
              className={cn(buttonVariants({ variant: "link" }), "text-foreground text-lg px-0")}
              href={"/"}
            >
              powerups.dev
            </a>
            {topLinks.map((link) => (
              <a
                key={link.href}
                className={cn(buttonVariants({ variant: "link" }), "text-foreground text-lg px-0")}
                href={link.href}
                target={link.target}
                rel={link.target === "_blank" ? "noreferrer" : undefined}
              >
                {link.label}
              </a>
            ))}
          </div>

          <Separator />

          {sectionLinks.map((section) => (
            <div key={section.title} className="flex flex-col gap-2 items-start">
              <p className="text-lg font-semibold text-foreground">{section.title}</p>
              <div className="flex flex-col gap-2 items-start">
                {section.links.map((link) => (
                  <a key={link.href} className={cn(buttonVariants({ variant: "link", size: "sm" }), "text-foreground/60 text-md")} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}