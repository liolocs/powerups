import { CodeBlock, type CodeBlockFile } from "@/components/ui/code-block"

interface Props {
  files: CodeBlockFile[];
}

export default function CodeBlockWithMultiplePackageManagers({
  files
}: Props) {
  return (<CodeBlock
    className='w-full'
    files={files}
  />)
}