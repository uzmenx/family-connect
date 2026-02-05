 import { cn } from '@/lib/utils';
 import { getSocialIcon, getSocialColor, SocialLink } from './SocialLinksEditor';
 
 interface SocialLinksListProps {
   links: SocialLink[];
   className?: string;
 }
 
 export const SocialLinksList = ({ links, className }: SocialLinksListProps) => {
   if (!links || links.length === 0) return null;
 
   const validLinks = links.filter(link => link.url && link.url.trim());
 
   if (validLinks.length === 0) return null;
 
   return (
     <div className={cn("flex flex-wrap gap-2", className)}>
       {validLinks.map((link, index) => {
         const Icon = getSocialIcon(link.type);
         const color = getSocialColor(link.type);
         const displayText = link.label || link.url.replace(/^https?:\/\//, '').slice(0, 25);
         
         return (
           <a
             key={index}
             href={link.url}
             target="_blank"
             rel="noopener noreferrer"
             className={cn(
               "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
               "text-white font-medium transition-all hover:scale-105 hover:shadow-lg",
               color
             )}
           >
             <Icon className="h-4 w-4" />
             <span className="max-w-[150px] truncate">{displayText}</span>
           </a>
         );
       })}
     </div>
   );
 };