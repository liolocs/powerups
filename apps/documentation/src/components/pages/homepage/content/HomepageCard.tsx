import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookIcon, FlaskIcon, GearIcon, LightningIcon } from "@phosphor-icons/react";
import { cn } from "cn";

interface Props {
  icon: "install-cli" | "use-powerup" | "author-powerup" | "command-reference" | "sdk-reference";
  title: string;
  description: string;
  cta: string;
}

const icons = {
  "install-cli": {
    class: "bg-yellow-100 dark:bg-yellow-900",
    icon: GearIcon,
    href: "/docs/guides/install"
  },
  "use-powerup": {
    class: "bg-blue-100 dark:bg-blue-900",
    icon: LightningIcon,
    href: "/docs/guides/quick-start/"
  },
  "author-powerup": {
    class: "bg-red-100 dark:bg-red-900",
    icon: FlaskIcon,
    href: "/docs/guides/authoring-powerups"
  },
  "command-reference": {
    class: "bg-green-100 dark:bg-green-900",
    icon: BookIcon,
    href: "/docs/reference/cli/install"
  },
  "sdk-reference": {
    class: "bg-purple-100 dark:bg-purple-900",
    icon: BookIcon,
    href: "/docs/reference/sdk"
  }
}

export default function HomepageCard(props: Props) {
  const IconComponent = icons[props.icon].icon;
  const bgClass = icons[props.icon].class;
  const href = icons[props.icon].href;

  return (
    <Card className="pb-0 flex-col justify-between">
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className={`${bgClass} size-8 rounded-md flex items-center justify-center`}>
              <IconComponent size="16" />
            </div>
            <p className="text-md text-foreground/80">{props.title}</p>
          </div>
          <p className="text-sm text-foreground/60 [&_code]:bg-muted [&_code]:py-1 [&_code]:px-2 [&_code]:rounded-md" dangerouslySetInnerHTML={{ __html: props.description }} />
        </div>
      </CardContent>
      <div className="w-full">
        <a className={cn(buttonVariants({ variant: "secondary" }), "text-foreground text-center p-4 w-full rounded-t-none")} href={href}>
          {props.cta}
        </a>
      </div>
    </Card>
  )
}