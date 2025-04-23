"use client"

import { useState, useEffect } from "react"
import { Github, GitPullRequest, Loader2, Save, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Template interface
interface PRTemplate {
  id: string
  name: string
  fromBranch: string
  toBranch: string
}

export default function Home() {
  const [token, setToken] = useState("")
  const [prNumber, setPrNumber] = useState("")
  const [prDetails, setPrDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingPR, setIsCreatingPR] = useState(false)
  const [repo, setRepo] = useState("owner/repo")
  const [templates, setTemplates] = useState<PRTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [newTemplate, setNewTemplate] = useState<Omit<PRTemplate, "id">>({
    name: "",
    fromBranch: "",
    toBranch: "",
  })
  const [mistralApiKey, setMistralApiKey] = useState("")
  const [prDescription, setPrDescription] = useState("")
  const [generatedDescription, setGeneratedDescription] = useState("")
  const [generatedEmail, setGeneratedEmail] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Load token from localStorage on component mount
    const storedToken = localStorage.getItem("githubToken")
    if (storedToken) {
      setToken(storedToken)
    }

    // Load repo from localStorage if available
    const storedRepo = localStorage.getItem("githubRepo")
    if (storedRepo) {
      setRepo(storedRepo)
    }

    // Load templates from localStorage
    const storedTemplates = localStorage.getItem("prTemplates")
    if (storedTemplates) {
      setTemplates(JSON.parse(storedTemplates))
    }

    // Load Mistral API key from localStorage
    const storedMistralKey = localStorage.getItem("mistralApiKey")
    if (storedMistralKey) {
      setMistralApiKey(storedMistralKey)
    }
  }, [])

  const saveToken = () => {
    if (token) {
      localStorage.setItem("githubToken", token)
      localStorage.setItem("githubRepo", repo)
      toast({
        title: "Token saved",
        description: "Your GitHub token has been saved to localStorage",
      })
    }
  }

  const saveMistralApiKey = () => {
    if (mistralApiKey) {
      localStorage.setItem("mistralApiKey", mistralApiKey)
      toast({
        title: "API Key saved",
        description: "Your Mistral AI API key has been saved to localStorage",
      })
    }
  }

  const fetchPRDetails = async () => {
    if (!token || !prNumber || !repo) {
      toast({
        title: "Missing information",
        description: "Please provide a GitHub token, repository, and PR number",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch PR: ${response.statusText}`)
      }

      const data = await response.json()
      setPrDetails(data)
      setPrDescription(data.body || "")
      toast({
        title: "PR details fetched",
        description: `Successfully fetched details for PR #${prNumber}`,
      })
    } catch (error) {
      console.error("Error fetching PR details:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch PR details",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createPR = async (environment: "Staging" | "Master") => {
    if (!prDetails) {
      toast({
        title: "No PR details",
        description: "Please fetch a source PR first",
        variant: "destructive",
      })
      return
    }

    setIsCreatingPR(true)
    try {
      // Extract task number from the title using regex
      const taskNumberMatch = prDetails.title.match(/HA-\d+/)
      const taskNumber = taskNumberMatch ? taskNumberMatch[0] : "TASK"

      // Extract the title without the task number
      let titleContent = prDetails.title
      if (taskNumberMatch) {
        titleContent = prDetails.title.replace(taskNumberMatch[0], "").trim()
        // Remove any "Development |" or similar prefixes
        titleContent = titleContent.replace(/^(\w+\s+\|)/, "").trim()
      }

      // Format the new PR title
      const newTitle = `${environment} | ${taskNumber} | ${titleContent}`

      // Determine source and target branches based on template or default
      let sourceBranch = environment === "Staging" ? prDetails.head.ref : "staging"
      let targetBranch = environment === "Staging" ? "staging" : "master"

      // If a template is selected, use its branch settings
      if (selectedTemplate) {
        const template = templates.find((t) => t.id === selectedTemplate)
        if (template) {
          sourceBranch = template.fromBranch
          targetBranch = template.toBranch
        }
      }

      const response = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle,
          body: prDetails.body,
          head: sourceBranch,
          base: targetBranch,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Failed to create PR: ${errorData.message || response.statusText}`)
      }

      const data = await response.json()
      toast({
        title: "PR created successfully",
        description: `${environment} PR #${data.number} has been created from ${sourceBranch} to ${targetBranch}`,
      })
    } catch (error) {
      console.error(`Error creating ${environment} PR:`, error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to create ${environment} PR`,
        variant: "destructive",
      })
    } finally {
      setIsCreatingPR(false)
    }
  }

  const saveTemplate = () => {
    if (!newTemplate.name || !newTemplate.fromBranch || !newTemplate.toBranch) {
      toast({
        title: "Missing information",
        description: "Please provide a name, source branch, and target branch for the template",
        variant: "destructive",
      })
      return
    }

    const newTemplateWithId = {
      ...newTemplate,
      id: Date.now().toString(),
    }

    const updatedTemplates = [...templates, newTemplateWithId]
    setTemplates(updatedTemplates)
    localStorage.setItem("prTemplates", JSON.stringify(updatedTemplates))

    // Reset form
    setNewTemplate({
      name: "",
      fromBranch: "",
      toBranch: "",
    })

    toast({
      title: "Template saved",
      description: `Template "${newTemplate.name}" has been saved`,
    })
  }

  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter((template) => template.id !== id)
    setTemplates(updatedTemplates)
    localStorage.setItem("prTemplates", JSON.stringify(updatedTemplates))

    if (selectedTemplate === id) {
      setSelectedTemplate("")
    }

    toast({
      title: "Template deleted",
      description: "The template has been deleted",
    })
  }

  const generateWithMistral = async () => {
    if (!mistralApiKey) {
      toast({
        title: "Missing API Key",
        description: "Please provide a Mistral AI API key",
        variant: "destructive",
      })
      return
    }

    if (!prDescription) {
      toast({
        title: "Missing description",
        description: "Please fetch a PR or enter a description",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      // Call Mistral API to generate PR description
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mistralApiKey}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            {
              role: "system",
              content:
                "You are an expert technical writer who helps developers create clear PR descriptions and QA emails.",
            },
            {
              role: "user",
              content: `I have a PR description that I want to improve and also create an email for the QA team.
              
Original PR description:
${prDescription}

Please provide:
1. A rewritten, well-structured PR description with clear sections for changes, impact, and testing instructions.
2. A professional email to the QA team explaining what needs to be tested.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Mistral API error: ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()
      const generatedText = data.choices[0].message.content

      // Split the response into PR description and email
      const sections = generatedText.split(/(?=2\.\s*A professional email)/i)

      if (sections.length >= 2) {
        // Extract PR description (first section)
        const prDescSection = sections[0].replace(/1\.\s*A rewritten[^:]*:/i, "").trim()
        setGeneratedDescription(prDescSection)

        // Extract email (second section)
        const emailSection = sections[1].replace(/2\.\s*A professional email[^:]*:/i, "").trim()
        setGeneratedEmail(emailSection)
      } else {
        // If splitting didn't work as expected, use the whole text as description
        setGeneratedDescription(generatedText)
        setGeneratedEmail("Could not generate a separate email. Please check the description.")
      }

      toast({
        title: "Generation complete",
        description: "PR description and QA email have been generated",
      })
    } catch (error) {
      console.error("Error generating with Mistral:", error)
      toast({
        title: "Generation error",
        description: error instanceof Error ? error.message : "Failed to generate content with Mistral AI",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="container mx-auto py-10 px-4 max-w-3xl">
      <h1 className="text-3xl font-bold text-center mb-8">GitHub PR Manager</h1>

      <Tabs defaultValue="auth" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="source">Source PR</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="create">Create PRs</TabsTrigger>
          <TabsTrigger value="ai">AI Rewrite</TabsTrigger>
        </TabsList>

        <TabsContent value="auth">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Authentication</CardTitle>
              <CardDescription>
                Enter your GitHub personal access token to authenticate with the GitHub API. The token will be stored in
                your browser's localStorage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">GitHub Personal Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Your token needs permissions for repo access.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo">Repository (owner/repo)</Label>
                <Input id="repo" placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveToken} className="w-full">
                <Github className="mr-2 h-4 w-4" />
                Save Token
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="source">
          <Card>
            <CardHeader>
              <CardTitle>Source PR</CardTitle>
              <CardDescription>Enter the PR number of the source PR you want to work with.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pr-number">PR Number</Label>
                <div className="flex space-x-2">
                  <Input
                    id="pr-number"
                    placeholder="123"
                    value={prNumber}
                    onChange={(e) => setPrNumber(e.target.value)}
                  />
                  <Button onClick={fetchPRDetails} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GitPullRequest className="mr-2 h-4 w-4" />
                    )}
                    Fetch
                  </Button>
                </div>
              </div>

              {prDetails && (
                <div className="mt-6 space-y-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium">PR #{prDetails.number}</h3>
                    <h4 className="text-lg font-semibold">{prDetails.title}</h4>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>
                        Branch: <span className="font-mono">{prDetails.head.ref}</span>
                      </p>
                      <p>Author: {prDetails.user.login}</p>
                    </div>
                    <div className="mt-4 rounded bg-muted p-3 text-sm">
                      <p className="font-medium">Description:</p>
                      <p className="whitespace-pre-line">{prDetails.body || "No description provided."}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>PR Templates</CardTitle>
              <CardDescription>Create and manage PR templates with custom branch configurations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Create New Template</h3>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      placeholder="Feature to Staging"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="from-branch">From Branch</Label>
                    <Input
                      id="from-branch"
                      placeholder="feature/my-feature"
                      value={newTemplate.fromBranch}
                      onChange={(e) => setNewTemplate({ ...newTemplate, fromBranch: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="to-branch">To Branch</Label>
                    <Input
                      id="to-branch"
                      placeholder="staging"
                      value={newTemplate.toBranch}
                      onChange={(e) => setNewTemplate({ ...newTemplate, toBranch: e.target.value })}
                    />
                  </div>
                  <Button onClick={saveTemplate} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Save Template
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Saved Templates</h3>
                {templates.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="text-muted-foreground">No templates saved yet. Create your first template above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-mono">{template.fromBranch}</span> →{" "}
                            <span className="font-mono">{template.toBranch}</span>
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteTemplate(template.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create PRs</CardTitle>
              <CardDescription>Create staging and master PRs based on the source PR.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!prDetails ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <GitPullRequest className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">No source PR loaded. Please fetch a PR first.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium">Current PR</h3>
                    <p className="text-lg font-semibold">{prDetails.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Branch: <span className="font-mono">{prDetails.head.ref}</span> →{" "}
                      <span className="font-mono">{prDetails.base.ref}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="template-select">Select Template (Optional)</Label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default branches</SelectItem>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} ({template.fromBranch} → {template.toBranch})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        If selected, the template's branch configuration will be used instead of the default.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <h3 className="font-medium">Staging PR</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Creates a PR from development branch to staging
                      </p>
                      <Button onClick={() => createPR("Staging")} disabled={isCreatingPR} className="w-full">
                        {isCreatingPR ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <GitPullRequest className="mr-2 h-4 w-4" />
                        )}
                        Create Staging PR
                      </Button>
                    </div>

                    <div className="rounded-lg border p-4">
                      <h3 className="font-medium">Master PR</h3>
                      <p className="text-sm text-muted-foreground mb-4">Creates a PR from staging branch to master</p>
                      <Button onClick={() => createPR("Master")} disabled={isCreatingPR} className="w-full">
                        {isCreatingPR ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <GitPullRequest className="mr-2 h-4 w-4" />
                        )}
                        Create Master PR
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Description Rewrite</CardTitle>
              <CardDescription>
                Use Mistral AI to rewrite your PR description and generate an email for the QA team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mistral-api-key">Mistral AI API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="mistral-api-key"
                      type="password"
                      placeholder="Enter your Mistral AI API key"
                      value={mistralApiKey}
                      onChange={(e) => setMistralApiKey(e.target.value)}
                    />
                    <Button onClick={saveMistralApiKey}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your API key will be stored in localStorage and used to access Mistral AI services.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pr-description">PR Description</Label>
                  <Textarea
                    id="pr-description"
                    placeholder="Enter or edit the PR description here"
                    value={prDescription}
                    onChange={(e) => setPrDescription(e.target.value)}
                    className="min-h-[150px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be used as input for the AI to generate an improved description and QA email.
                  </p>
                </div>

                <Button
                  onClick={generateWithMistral}
                  disabled={isGenerating || !mistralApiKey || !prDescription}
                  className="w-full"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <span>Generate Improved Description & QA Email</span>
                  )}
                </Button>
              </div>

              {(generatedDescription || generatedEmail) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="generated-description">Improved PR Description</Label>
                    <div className="relative">
                      <Textarea
                        id="generated-description"
                        value={generatedDescription}
                        onChange={(e) => setGeneratedDescription(e.target.value)}
                        className="min-h-[200px]"
                      />
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="absolute top-2 right-2">
                            Copy
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>PR Description Copied</DialogTitle>
                            <DialogDescription>
                              The improved PR description has been copied to your clipboard.
                            </DialogDescription>
                          </DialogHeader>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="generated-email">QA Team Email</Label>
                    <div className="relative">
                      <Textarea
                        id="generated-email"
                        value={generatedEmail}
                        onChange={(e) => setGeneratedEmail(e.target.value)}
                        className="min-h-[200px]"
                      />
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="absolute top-2 right-2">
                            Copy
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>QA Email Copied</DialogTitle>
                            <DialogDescription>The QA team email has been copied to your clipboard.</DialogDescription>
                          </DialogHeader>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Toaster />
    </main>
  )
}
