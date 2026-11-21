import { GitHubIcon } from "@/src/components/icons/GitHubIcon";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/src/components/ui/sidebar";
import { GITHUB_STAR_URL } from "@/src/shared/constants";

export function StarOnGitHubLink() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Star Scrapecat on GitHub">
        <a href={GITHUB_STAR_URL} target="_blank" rel="noreferrer noopener">
          <GitHubIcon className="size-4" />
          <span>Star on GitHub</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
