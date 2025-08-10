"use client"

import { useEffect, useState } from "react"
import { Editor } from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PolicyEditorProps {
  policy: any
}

export function PolicyEditor({ policy }: PolicyEditorProps) {
  const [editorMode, setEditorMode] = useState<"yaml" | "rego">("yaml")
  const [originalCode, setOriginalCode] = useState("")
  const [modifiedCode, setModifiedCode] = useState("")

  // Generate sample code based on policy type
  useEffect(() => {
    if (!policy) return

    let code = ""

    if (policy.type === "OPA/Gatekeeper") {
      if (editorMode === "yaml") {
        code = `apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sPSPPrivilegedContainer
metadata:
  name: ${policy.id}
  annotations:
    description: ${policy.description}
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    ${policy.scope === "Cluster-wide" ? "" : `namespaces: ["${policy.scope.replace(" Namespace", "")}"]`}
  parameters:
    privileged: false`
      } else {
        code = `package kubernetes.admission

deny[msg] {
  input.request.kind.kind == "Pod"
  c := input.request.object.spec.containers[_]
  c.securityContext.privileged
  msg := sprintf("Privileged container is not allowed: %v", [c.name])
}`
      }
    } else if (policy.type === "Network Policy") {
      code = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${policy.id}
  ${policy.scope !== "Cluster-wide" ? `namespace: ${policy.scope.replace(" Namespace", "")}` : ""}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: default
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: default`
    } else {
      code = `apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: ${policy.id}
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      - min: 1
        max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1
        max: 65535
  readOnlyRootFilesystem: false`
    }

    setOriginalCode(code)
    setModifiedCode(code)
  }, [policy, editorMode])

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setModifiedCode(value)
    }
  }

  return (
    <div className="h-full">
      <Tabs defaultValue="editor" className="h-full">
        <div className="mb-4 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="diff">Diff View</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={editorMode === "yaml" ? "bg-secondary" : ""}
              onClick={() => setEditorMode("yaml")}
            >
              YAML
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={editorMode === "rego" ? "bg-secondary" : ""}
              onClick={() => setEditorMode("rego")}
              disabled={policy?.type !== "OPA/Gatekeeper"}
            >
              Rego
            </Button>
          </div>
        </div>

        <TabsContent value="editor" className="h-[calc(100%-56px)] mt-0">
          <Editor
            height="100%"
            defaultLanguage={editorMode === "yaml" ? "yaml" : "ruby"}
            value={modifiedCode}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              tabSize: 2,
            }}
          />
        </TabsContent>

        <TabsContent value="diff" className="h-[calc(100%-56px)] mt-0">
          <Editor
            height="100%"
            defaultLanguage={editorMode === "yaml" ? "yaml" : "ruby"}
            original={originalCode}
            modified={modifiedCode}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              tabSize: 2,
              renderSideBySide: true,
              diffWordWrap: "off",
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
