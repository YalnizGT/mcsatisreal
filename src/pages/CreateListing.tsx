import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

// 💰 Komisyon Oranı Sabiti
const COMMISSION_RATE = 0.10; // %10 komisyon

const CreateListing = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category_id: "",
    platform: "",
    tags: "",
    stock: "1",
    auto_delivery: false,
    auto_delivery_content: "",
  });
  
  // 💰 Yeni State: Hesaplanan Net Tutar
  const [netAmount, setNetAmount] = useState<number | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("active", true);
      return data;
    },
  });

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  // 💰 Yeni Fonksiyon: Fiyat değiştiğinde net tutarı hesaplar
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const priceString = e.target.value;
    setFormData({ ...formData, price: priceString });

    const price = parseFloat(priceString);
    
    if (isNaN(price) || price <= 0) {
      setNetAmount(null);
    } else {
      // Net Tutar Hesaplama: Fiyat * (1 - Komisyon Oranı)
      const commission = price * COMMISSION_RATE;
      const net = price - commission;
      // Tutarın 2 ondalık basamaklı olmasını sağlayalım
      setNetAmount(parseFloat(net.toFixed(2))); 
    }
  };


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 5) {
      toast({ title: "Hata", description: "Maksimum 5 fotoğraf yükleyebilirsiniz", variant: "destructive" });
      return;
    }
    
    setImageFiles([...imageFiles, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
    setImagePreview(imagePreview.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (imageFiles.length === 0) return [];
    
    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    for (const file of imageFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${session?.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    setUploadingImages(false);
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user) {
      toast({ title: "Hata", description: "Oturum açmanız gerekiyor", variant: "destructive" });
      return;
    }

    const imageUrls = await uploadImages();

    const { error } = await supabase.from("listings").insert({
      ...formData,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      tags: formData.tags.split(",").map(t => t.trim()),
      images: imageUrls,
      user_id: session.user.id,
      status: "active",
    });

    if (error) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Başarılı", description: "İlan yayınlandı" });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="border-glass-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl">
              <span className="bg-gradient-to-r from-brand-blue to-primary bg-clip-text text-transparent">
                {id ? "İlan Düzenle" : "Yeni İlan Oluştur"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="title">İlan Başlığı *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Örn: Steam Premium Hesap - 200+ Oyun"
                  required
                  className="bg-dark-surface border-glass-border"
                />
              </div>

              <div>
                <Label htmlFor="description">Açıklama *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="İlanınızın detaylı açıklaması..."
                  rows={5}
                  required
                  className="bg-dark-surface border-glass-border"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Fiyat (₺) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    // 🎉 Güncellenen Fonksiyon
                    onChange={handlePriceChange} 
                    placeholder="0.00"
                    required
                    className="bg-dark-surface border-glass-border"
                  />
                  
                  {/* 🎉 Net Tutar Gösterimi 🎉 */}
                  {netAmount !== null && (
                    <p className="mt-1 text-sm text-green-400">
                      <span className="font-bold">Size Aktarılacak Net Tutar:</span> {netAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                      <span className="text-gray-400 ml-2">({COMMISSION_RATE * 100}% komisyon dahil)</span>
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="stock">Stok Adedi *</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="1"
                    required
                    className="bg-dark-surface border-glass-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Kategori *</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })} required>
                    <SelectTrigger className="bg-dark-surface border-glass-border">
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <Input
                    id="platform"
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    placeholder="PC, Mobile, Console"
                    className="bg-dark-surface border-glass-border"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="images">Fotoğraflar (Maksimum 5)</Label>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="bg-dark-surface border-glass-border"
                />
                {imagePreview.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {imagePreview.map((preview, index) => (
                      <div key={index} className="relative">
                        <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-20 object-cover rounded" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="tags">Etiketler</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="Steam, Premium, CS2 (virgülle ayırın)"
                  className="bg-dark-surface border-glass-border"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-dark-surface/50">
                <div>
                  <Label htmlFor="auto-delivery">Otomatik Teslimat</Label>
                  <p className="text-sm text-muted-foreground">
                    Ödeme sonrası otomatik teslim edilsin
                  </p>
                </div>
                <Switch
                  id="auto-delivery"
                  checked={formData.auto_delivery}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_delivery: checked })}
                />
              </div>

              {formData.auto_delivery && (
                <div>
                  <Label htmlFor="auto-content">Otomatik Teslimat İçeriği</Label>
                  <Textarea
                    id="auto-content"
                    value={formData.auto_delivery_content}
                    onChange={(e) => setFormData({ ...formData, auto_delivery_content: e.target.value })}
                    placeholder="Kullanıcı adı, şifre veya kod bilgisi"
                    rows={3}
                    className="bg-dark-surface border-glass-border"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1"
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  disabled={uploadingImages}
                  className="flex-1 bg-gradient-to-r from-brand-blue to-primary hover:opacity-90"
                >
                  {uploadingImages ? "Fotoğraflar Yükleniyor..." : "İlan Yayınla"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default CreateListing;