import LogoImage from "@/public/logo.png";
import Image from "next/image";
import { BRAND } from "@/src/shared/constants";

export function Logo() {
    return (
        <div className="flex flex-col items-center">
            <Image src={LogoImage} alt={BRAND.logoAlt} width={100} height={100} />
            <span className="font-semibold italic">{BRAND.name}</span>
            <span className="text-xs text-muted-foreground"><span className="font-semibold text-primary">Reports</span> from GitHub commits</span>
        </div>
    )
}