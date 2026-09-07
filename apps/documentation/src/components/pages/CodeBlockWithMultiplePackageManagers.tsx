import { CodeBlock, type CodeBlockFile } from "@/components/ui/code-block"

interface Props {
  files: CodeBlockFile[];
  autoHeight?: boolean;
}

export default function CodeBlockWithMultiplePackageManagers({
  files,
  autoHeight,
}: Props) {
  return (<CodeBlock
    className='w-full'
    files={autoHeight ? files.map(f => ({ ...f, autoHeight: true })) : files}
  />)
}