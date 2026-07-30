import LogoImage from "@/public/logo.png";
import Image from "next/image";

export function Logo() {
    return (
        <div className="flex flex-col items-center">
            <Image src={LogoImage} alt="Commits AI Logo" width={100} height={100} />
            <span className="font-semibold italic">Scrapecat</span>
            <span className="text-xs text-muted-foreground"><span className="font-semibold text-primary">Reports</span> from GitHub commits</span>
        </div>
    )
}