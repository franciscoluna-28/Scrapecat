import LogoImage from "@/public/logo.png";
import Image from "next/image";
import { BRAND } from "@/src/shared/constants";

type LogoProps = {
    shouldDisplayMetadata?: boolean;
    shouldDisplayBrandName?: boolean;
}

export function Logo({ shouldDisplayMetadata = true, shouldDisplayBrandName = true }: LogoProps) {
    return (
        <div className="flex flex-col items-center">
            <Image src={LogoImage} alt={BRAND.logoAlt} width={100} height={100} />
            {shouldDisplayBrandName && (
                <span className="font-semibold italic">{BRAND.name}</span>
            )}
            {shouldDisplayMetadata && (
                <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">Answers</span> from GitHub commits
                </span>
            )}
        </div>
    )
}