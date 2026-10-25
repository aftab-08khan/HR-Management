import {Slot} from '@radix-ui/react-slot';
import {cva} from 'class-variance-authority';
import {clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';
const variants=cva('btn',{variants:{variant:{default:'btn-primary',outline:'btn-outline',ghost:'btn-ghost'},size:{default:'',sm:'btn-sm'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,...props}){const Comp=asChild?Slot:'button';return <Comp className={twMerge(clsx(variants({variant,size}),className))} {...props}/>}
