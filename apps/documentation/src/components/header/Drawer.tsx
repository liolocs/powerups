import { Button, buttonVariants } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

const topLinks = [
  { label: "Guides", href: "/guides" },
  { label: "Powerups", href: "/powerups" },
]

const sectionLinks = [
  {
    title: "Guides", links: [
      { label: "Install the CLI", href: "/guides/install-cli" },
      { label: "Quickstart", href: "/guides/quickstart" },
      { label: "Authoring Powerups", href: "/guides/authoring-powerups" },
      { label: "Create a Powerup from an Existing Repo", href: "/guides/create-powerup-existing-repo" }
    ]
  },
  {
    title: "Reference", links: [
      { label: "CLI", href: "/reference/cli" },
      { label: "SDK", href: "/reference/sdk" }
    ]
  }
]

export default function HeaderDrawer() {
  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger>
        <Button variant="ghost" size="icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="stroke-foreground size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5"></path></svg>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[70vh]">
        <div className="flex-1 p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 items-start">
            {topLinks.map((link) => (
              <a key={link.label} className={cn(buttonVariants({ variant: "link" }), "text-foreground text-lg px-0")} href={link.href} key={link.label}>
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
                  <a className={cn(buttonVariants({ variant: "link", size: "sm" }), "text-foreground/60 text-md")} href={link.href} key={link.label}>
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